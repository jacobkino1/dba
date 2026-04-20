from typing import Optional
import ipaddress

from fastapi import Header, HTTPException, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import SessionLocal
from database.models import (
    User, 
    OrganisationMembership, 
    ClinicMembership,
    NetworkAccess,
    AllowedIP,
    )

from permissions import normalize_permission_level
from auth_utils import decode_access_token


class CurrentUser(BaseModel):
    userId: str
    displayName: str
    email: Optional[str] = None
    username: Optional[str] = None
    accountType: str
    organisationId: str
    selectedClinicId: Optional[str] = None
    organisationPermissionLevel: Optional[str] = None


security_scheme = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return ""


def is_ip_allowed(client_ip: str, allowed_values: list[str]) -> bool:
    if not client_ip:
        return False

    try:
        parsed_ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    for raw_value in allowed_values:
        value = str(raw_value or "").strip()
        if not value:
            continue

        try:
            if "/" in value:
                network = ipaddress.ip_network(value, strict=False)
                if parsed_ip in network:
                    return True
            else:
                allowed_ip = ipaddress.ip_address(value)
                if parsed_ip == allowed_ip:
                    return True
        except ValueError:
            continue

    return False


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    x_selected_clinic_id: Optional[str] = Header(None, alias="X-Selected-Clinic-Id"),
    db: Session = Depends(get_db),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = decode_access_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.userId == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="User is not active")

    account_type = (getattr(user, "accountType", None) or "work").strip().lower()
    if account_type not in {"work", "workstation", "service"}:
        raise HTTPException(status_code=403, detail="Invalid account type")

    org_memberships = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.userId == user.userId)
        .all()
    )

    clinic_memberships = (
        db.query(ClinicMembership)
        .filter(ClinicMembership.userId == user.userId)
        .all()
    )

    if not org_memberships and not clinic_memberships:
        raise HTTPException(
            status_code=403,
            detail="User is not assigned to an organisation or clinic",
        )

    organisation_id = None
    organisation_permission = None

    if org_memberships:
        chosen_org_membership = org_memberships[0]
        organisation_id = chosen_org_membership.organisationId
        organisation_permission = normalize_permission_level(
            chosen_org_membership.permissionLevel
        )
    else:
        chosen_clinic_membership = clinic_memberships[0]
        organisation_id = chosen_clinic_membership.organisationId
        organisation_permission = None

    print("X-Selected-Clinic-Id:", x_selected_clinic_id)
    if x_selected_clinic_id:
        selected_clinic_membership = (
            db.query(ClinicMembership)
            .filter(
                ClinicMembership.userId == user.userId,
                ClinicMembership.organisationId == organisation_id,
                ClinicMembership.clinicId == x_selected_clinic_id,
            )
            .first()
        )

        is_org_admin = organisation_permission == "admin"

        if not selected_clinic_membership and not is_org_admin:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to the selected clinic",
            )

        network_access = (
            db.query(NetworkAccess)
            .filter(
                NetworkAccess.organisationId == organisation_id,
                NetworkAccess.clinicId == x_selected_clinic_id,
            )
            .first()
        )

        if network_access and str(network_access.mode).strip().lower() == "restricted":
            allowed_ip_rows = (
                db.query(AllowedIP)
                .filter(
                    AllowedIP.organisationId == organisation_id,
                    AllowedIP.clinicId == x_selected_clinic_id,
                )
                .all()
            )

            allowed_values = [row.value for row in allowed_ip_rows]
            client_ip = get_client_ip(request)
            print("CLIENT IP:", client_ip)

            if not allowed_values:
                raise HTTPException(
                    status_code=403,
                    detail="This clinic is restricted but has no allowed IP addresses configured",
                )

            if not is_ip_allowed(client_ip, allowed_values):
                raise HTTPException(
                    status_code=403,
                    detail="Access denied from this network",
                )

    return CurrentUser(
        userId=user.userId,
        displayName=user.displayName,
        email=user.email,
        username=getattr(user, "username", None),
        accountType=account_type,
        organisationId=organisation_id,
        selectedClinicId=x_selected_clinic_id,
        organisationPermissionLevel=organisation_permission,
    )


def require_organisation_access(user: CurrentUser, organisation_id: str):
    if user.organisationId != organisation_id:
        raise HTTPException(status_code=403, detail="You do not have access to this organisation")


def require_selected_clinic(user: CurrentUser) -> str:
    if not user.selectedClinicId:
        raise HTTPException(status_code=400, detail="No clinic selected")
    return user.selectedClinicId


def is_work_account(user: CurrentUser) -> bool:
    return user.accountType == "work"


def is_workstation_account(user: CurrentUser) -> bool:
    return user.accountType == "workstation"


def require_work_account(user: CurrentUser) -> None:
    if not is_work_account(user):
        raise HTTPException(status_code=403, detail="This action is only available for work accounts")


def require_non_workstation_account(user: CurrentUser) -> None:
    if is_workstation_account(user):
        raise HTTPException(status_code=403, detail="This action is not available for workstation accounts")