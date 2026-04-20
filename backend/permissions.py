from typing import Iterable, Optional


PERMISSION_RANK = {
    "read": 1,
    "write": 2,
    "manage": 3,
    "admin": 4,
}


VALID_PERMISSION_LEVELS = tuple(PERMISSION_RANK.keys())


def normalize_permission_level(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    normalized = str(value).strip().lower()
    if normalized not in PERMISSION_RANK:
        return None

    return normalized


def require_valid_permission_level(value: Optional[str]) -> str:
    normalized = normalize_permission_level(value)
    if not normalized:
        raise ValueError(f"Invalid permission level: {value}")
    return normalized


def has_level(user_level: Optional[str], required_level: Optional[str]) -> bool:
    normalized_user = normalize_permission_level(user_level)
    normalized_required = normalize_permission_level(required_level)

    if not normalized_user or not normalized_required:
        return False

    return PERMISSION_RANK[normalized_user] >= PERMISSION_RANK[normalized_required]


def get_assignable_levels(actor_level: Optional[str]) -> list[str]:
    normalized_actor = normalize_permission_level(actor_level)
    if not normalized_actor:
        return []

    if normalized_actor == "admin":
        return ["admin", "manage", "write", "read"]

    if normalized_actor == "manage":
        return ["manage", "write", "read"]

    return []


def get_assignable_document_levels(actor_level: Optional[str]) -> list[str]:
    normalized_actor = normalize_permission_level(actor_level)
    if not normalized_actor:
        return []

    if normalized_actor == "admin":
        return ["admin", "manage", "write", "read"]

    if normalized_actor == "manage":
        return ["manage", "write", "read"]

    if normalized_actor == "write":
        return ["write", "read"]

    return []


def can_grant_level(actor_level: Optional[str], target_level: Optional[str]) -> bool:
    normalized_target = normalize_permission_level(target_level)
    if not normalized_target:
        return False

    return normalized_target in get_assignable_levels(actor_level)


def can_grant_document_level(actor_level: Optional[str], target_level: Optional[str]) -> bool:
    normalized_target = normalize_permission_level(target_level)
    if not normalized_target:
        return False

    return normalized_target in get_assignable_document_levels(actor_level)


def get_accessible_document_levels(user_level: Optional[str]) -> list[str]:
    normalized_user = normalize_permission_level(user_level)
    if not normalized_user:
        return []

    return [
        level
        for level, rank in PERMISSION_RANK.items()
        if rank <= PERMISSION_RANK[normalized_user]
    ]


def can_view_document(user_level: Optional[str], document_level: Optional[str]) -> bool:
    normalized_document = normalize_permission_level(document_level)
    if not normalized_document:
        return False

    return has_level(user_level, normalized_document)


def can_download_document(user_level: Optional[str]) -> bool:
    return has_level(user_level, "write")


def can_upload_document(user_level: Optional[str]) -> bool:
    return has_level(user_level, "write")


def can_replace_document(user_level: Optional[str]) -> bool:
    return has_level(user_level, "write")


def can_archive_document(user_level: Optional[str]) -> bool:
    return has_level(user_level, "manage")


def can_restore_document(user_level: Optional[str]) -> bool:
    return has_level(user_level, "manage")


def can_delete_document(user_level: Optional[str]) -> bool:
    return has_level(user_level, "manage")


def can_view_activity(user_level: Optional[str]) -> bool:
    return has_level(user_level, "manage")


def can_create_users(user_level: Optional[str]) -> bool:
    return has_level(user_level, "manage")


def can_assign_org_scope(user_level: Optional[str]) -> bool:
    return has_level(user_level, "admin")


def can_manage_shared_documents(user_level: Optional[str]) -> bool:
    return has_level(user_level, "admin")


def ensure_permission_level_in_list(value: Optional[str], allowed_levels: Iterable[str]) -> bool:
    normalized_value = normalize_permission_level(value)
    if not normalized_value:
        return False

    normalized_allowed = {
        level for level in (normalize_permission_level(item) for item in allowed_levels) if level
    }

    return normalized_value in normalized_allowed