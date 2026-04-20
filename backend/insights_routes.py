from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import SessionLocal
from database.models import AskLog, OrganisationMembership, ClinicMembership
from security import CurrentUser, get_current_user, require_non_workstation_account
from permissions import has_level, normalize_permission_level


router = APIRouter(prefix="/chat/insights", tags=["chat-insights"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_organisation_membership(
    db: Session,
    *,
    user_id: str,
    organisation_id: str,
) -> OrganisationMembership | None:
    return (
        db.query(OrganisationMembership)
        .filter(
            OrganisationMembership.userId == user_id,
            OrganisationMembership.organisationId == organisation_id,
        )
        .first()
    )


def get_clinic_membership(
    db: Session,
    *,
    user_id: str,
    organisation_id: str,
    clinic_id: str,
) -> ClinicMembership | None:
    return (
        db.query(ClinicMembership)
        .filter(
            ClinicMembership.userId == user_id,
            ClinicMembership.organisationId == organisation_id,
            ClinicMembership.clinicId == clinic_id,
        )
        .first()
    )


def get_effective_permission_level(
    db: Session,
    *,
    user: CurrentUser,
    clinic_id: str | None,
) -> str | None:
    org_membership = get_organisation_membership(
        db,
        user_id=user.userId,
        organisation_id=user.organisationId,
    )

    org_level = normalize_permission_level(
        org_membership.permissionLevel if org_membership else user.organisationPermissionLevel
    )

    if org_level == "admin":
        return "admin"

    if clinic_id:
        clinic_membership = get_clinic_membership(
            db,
            user_id=user.userId,
            organisation_id=user.organisationId,
            clinic_id=clinic_id,
        )
        clinic_level = normalize_permission_level(
            clinic_membership.permissionLevel if clinic_membership else None
        )

        if clinic_level:
            return clinic_level

    return org_level


class InsightQuestionItem(BaseModel):
    question: str
    count: int


class ChatInsightsSummaryResponse(BaseModel):
    organisationId: str
    clinicId: Optional[str] = None
    days: int

    totalAsks: int
    answeredCount: int
    noRelevantDocsCount: int
    modelErrorCount: int

    answerRate: float

    topUnansweredQuestions: list[InsightQuestionItem]
    topModelErrorQuestions: list[InsightQuestionItem]


def normalize_question(value: str) -> str:
    return " ".join((value or "").strip().split())


@router.get("/summary", response_model=ChatInsightsSummaryResponse)
def get_chat_insights_summary(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_non_workstation_account(current_user)
    selected_clinic_id = current_user.selectedClinicId

    effective_level = get_effective_permission_level(
        db,
        user=current_user,
        clinic_id=selected_clinic_id,
    )

    if not effective_level or not has_level(effective_level, "manage"):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view chat insights",
        )

    start_date = datetime.utcnow() - timedelta(days=days)

    query = db.query(AskLog).filter(
        AskLog.organisationId == current_user.organisationId,
        AskLog.createdAt >= start_date,
    )

    if selected_clinic_id:
        query = query.filter(AskLog.clinicId == selected_clinic_id)

    logs = query.order_by(AskLog.createdAt.desc()).all()

    total_asks = len(logs)
    answered_count = sum(1 for item in logs if item.outcomeStatus == "answered")
    no_relevant_docs_count = sum(
        1 for item in logs if item.outcomeStatus == "no_relevant_docs"
    )
    model_error_count = sum(1 for item in logs if item.outcomeStatus == "model_error")

    answer_rate = round((answered_count / total_asks) * 100, 1) if total_asks > 0 else 0.0

    unanswered_counter = Counter(
        normalize_question(item.question)
        for item in logs
        if item.outcomeStatus == "no_relevant_docs" and normalize_question(item.question)
    )

    model_error_counter = Counter(
        normalize_question(item.question)
        for item in logs
        if item.outcomeStatus == "model_error" and normalize_question(item.question)
    )

    top_unanswered_questions = [
        InsightQuestionItem(question=question, count=count)
        for question, count in unanswered_counter.most_common(limit)
    ]

    top_model_error_questions = [
        InsightQuestionItem(question=question, count=count)
        for question, count in model_error_counter.most_common(limit)
    ]

    return ChatInsightsSummaryResponse(
        organisationId=current_user.organisationId,
        clinicId=selected_clinic_id,
        days=days,
        totalAsks=total_asks,
        answeredCount=answered_count,
        noRelevantDocsCount=no_relevant_docs_count,
        modelErrorCount=model_error_count,
        answerRate=answer_rate,
        topUnansweredQuestions=top_unanswered_questions,
        topModelErrorQuestions=top_model_error_questions,
    )