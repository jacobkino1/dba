import uuid
from typing import Optional
from sqlalchemy.orm import Session
from database.models import AskLog


def create_ask_log(
    db: Session,
    *,
    organisation_id: str,
    clinic_id: Optional[str],
    user_id: str,
    conversation_id: Optional[str],
    question: str,
    outcome_status: str,
    failure_reason: Optional[str] = None,
) -> AskLog:
    ask_log = AskLog(
        askLogId=str(uuid.uuid4()),
        organisationId=organisation_id,
        clinicId=clinic_id,
        userId=user_id,
        conversationId=conversation_id,
        question=question,
        outcomeStatus=outcome_status,
        failureReason=failure_reason,
    )
    db.add(ask_log)
    return ask_log