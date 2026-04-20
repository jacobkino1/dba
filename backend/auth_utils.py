import os
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext
from fastapi import HTTPException


JWT_SECRET = os.getenv("DBA_JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("DBA_JWT_EXPIRE_MINUTES", "480"))

if not JWT_SECRET:
    raise RuntimeError("DBA_JWT_SECRET is required")

if len(JWT_SECRET.encode("utf-8")) < 32:
    raise RuntimeError("DBA_JWT_SECRET must be at least 32 bytes long")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user_id: str, organisation_id: str, account_type: str) -> str:
    normalized_account_type = (account_type or "").strip().lower()
    if normalized_account_type not in {"work", "workstation", "service"}:
        raise ValueError("Invalid account type for token creation")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "organisationId": organisation_id,
        "accountType": normalized_account_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")