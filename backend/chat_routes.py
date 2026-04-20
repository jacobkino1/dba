import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database.db import SessionLocal
from database.models import Conversation, ConversationMessage
from security import (
    CurrentUser,
    get_current_user,
    require_selected_clinic,
    require_non_workstation_account,
)


router = APIRouter(prefix="/chat", tags=["chat"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CreateConversationRequest(BaseModel):
    title: str | None = None


class ConversationListItemResponse(BaseModel):
    conversationId: str
    clinicId: str
    title: str
    createdAt: datetime
    updatedAt: datetime
    messageCount: int


class CreateConversationResponse(BaseModel):
    conversationId: str
    clinicId: str
    title: str
    createdAt: datetime
    updatedAt: datetime


class ConversationMessageItemResponse(BaseModel):
    messageId: str
    role: str
    content: str
    sourceJson: str | None = None
    createdAt: datetime


class ConversationMessagesResponse(BaseModel):
    conversationId: str
    clinicId: str
    title: str
    createdAt: datetime
    updatedAt: datetime
    messages: list[ConversationMessageItemResponse]


class AppendConversationMessageRequest(BaseModel):
    role: str
    content: str
    sourceJson: str | None = None


def normalize_role(value: str) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized not in {"user", "assistant"}:
        return None
    return normalized

def require_chat_history_access(current_user: CurrentUser) -> None:
    require_non_workstation_account(current_user)

def get_conversation_or_404(
    db: Session,
    *,
    conversation_id: str,
    current_user: CurrentUser,
    selected_clinic_id: str,
) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.conversationId == conversation_id,
            Conversation.organisationId == current_user.organisationId,
            Conversation.clinicId == selected_clinic_id,
            Conversation.createdByUserId == current_user.userId,
            Conversation.status == "active",
        )
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation


@router.get("/conversations", response_model=list[ConversationListItemResponse])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_chat_history_access(current_user)
    selected_clinic_id = require_selected_clinic(current_user)

    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.organisationId == current_user.organisationId,
            Conversation.clinicId == selected_clinic_id,
            Conversation.createdByUserId == current_user.userId,
            Conversation.status == "active",
        )
        .order_by(desc(Conversation.updatedAt))
        .all()
    )

    results: list[ConversationListItemResponse] = []

    for conversation in conversations:
        message_count = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversationId == conversation.conversationId)
            .count()
        )

        results.append(
            ConversationListItemResponse(
                conversationId=conversation.conversationId,
                clinicId=conversation.clinicId,
                title=conversation.title or "New chat",
                createdAt=conversation.createdAt,
                updatedAt=conversation.updatedAt,
                messageCount=message_count,
            )
        )

    return results


@router.post("/conversations", response_model=CreateConversationResponse)
def create_conversation(
    req: CreateConversationRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_chat_history_access(current_user)
    selected_clinic_id = require_selected_clinic(current_user)

    title = (req.title or "").strip() or "New chat"
    now = datetime.utcnow()

    conversation = Conversation(
        conversationId=str(uuid.uuid4()),
        organisationId=current_user.organisationId,
        clinicId=selected_clinic_id,
        createdByUserId=current_user.userId,
        title=title,
        status="active",
        createdAt=now,
        updatedAt=now,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return CreateConversationResponse(
        conversationId=conversation.conversationId,
        clinicId=conversation.clinicId,
        title=conversation.title or "New chat",
        createdAt=conversation.createdAt,
        updatedAt=conversation.updatedAt,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
)
def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_chat_history_access(current_user)
    selected_clinic_id = require_selected_clinic(current_user)

    conversation = get_conversation_or_404(
        db,
        conversation_id=conversation_id,
        current_user=current_user,
        selected_clinic_id=selected_clinic_id,
    )

    messages = (
        db.query(ConversationMessage)
        .filter(
            ConversationMessage.conversationId == conversation.conversationId,
            ConversationMessage.organisationId == current_user.organisationId,
            ConversationMessage.clinicId == selected_clinic_id,
        )
        .order_by(ConversationMessage.createdAt.asc())
        .all()
    )

    return ConversationMessagesResponse(
        conversationId=conversation.conversationId,
        clinicId=conversation.clinicId,
        title=conversation.title or "New chat",
        createdAt=conversation.createdAt,
        updatedAt=conversation.updatedAt,
        messages=[
            ConversationMessageItemResponse(
                messageId=message.messageId,
                role=message.role,
                content=message.content,
                sourceJson=message.sourceJson,
                createdAt=message.createdAt,
            )
            for message in messages
        ],
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessageItemResponse,
)
def append_conversation_message(
    conversation_id: str,
    req: AppendConversationMessageRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_chat_history_access(current_user)
    selected_clinic_id = require_selected_clinic(current_user)

    conversation = get_conversation_or_404(
        db,
        conversation_id=conversation_id,
        current_user=current_user,
        selected_clinic_id=selected_clinic_id,
    )

    normalized_role = normalize_role(req.role)
    if not normalized_role:
        raise HTTPException(status_code=400, detail="Invalid message role")

    content = (req.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    message = ConversationMessage(
        messageId=str(uuid.uuid4()),
        conversationId=conversation.conversationId,
        organisationId=current_user.organisationId,
        clinicId=selected_clinic_id,
        userId=current_user.userId if normalized_role == "user" else None,
        role=normalized_role,
        content=content,
        sourceJson=req.sourceJson,
    )

    conversation.updatedAt = datetime.utcnow()

    if (
        (conversation.title or "").strip() in {"", "New chat"}
        and normalized_role == "user"
    ):
        trimmed_title = content[:80].strip()
        conversation.title = trimmed_title or "New chat"

    db.add(message)
    db.commit()
    db.refresh(message)

    return ConversationMessageItemResponse(
        messageId=message.messageId,
        role=message.role,
        content=message.content,
        sourceJson=message.sourceJson,
        createdAt=message.createdAt,
    )