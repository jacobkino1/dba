from pydantic import BaseModel
from typing import Optional


class ClinicMembershipPayload(BaseModel):
    clinicId: str
    permissionLevel: str


class AuthUserPayload(BaseModel):
    userId: str
    displayName: str
    email: Optional[str] = None
    username: Optional[str] = None
    accountType: str
    organisationId: str
    organisationPermissionLevel: Optional[str] = None
    clinicMemberships: list[ClinicMembershipPayload]


class LoginRequest(BaseModel):
    email: str
    password: str


class WorkstationLoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    mustSetPassword: bool = False
    user: AuthUserPayload


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class ResetPasswordRequest(BaseModel):
    targetUserId: str