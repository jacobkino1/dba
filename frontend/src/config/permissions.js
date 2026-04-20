const PERMISSION_RANK = {
  read: 1,
  write: 2,
  manage: 3,
  admin: 4,
};

export const PERMISSION_LEVELS = ["admin", "manage", "write", "read"];

export function normalizePermissionLevel(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  return PERMISSION_RANK[normalized] ? normalized : null;
}

export function hasLevel(userLevel, requiredLevel) {
  const normalizedUser = normalizePermissionLevel(userLevel);
  const normalizedRequired = normalizePermissionLevel(requiredLevel);

  if (!normalizedUser || !normalizedRequired) {
    return false;
  }

  return PERMISSION_RANK[normalizedUser] >= PERMISSION_RANK[normalizedRequired];
}

export function getClinicPermissionLevel(user, clinicId) {
  if (!user || !clinicId) return null;

  const membership = Array.isArray(user.clinicMemberships)
    ? user.clinicMemberships.find((item) => item.clinicId === clinicId)
    : null;

  return normalizePermissionLevel(membership?.permissionLevel);
}

export function getEffectivePermissionLevel(user, clinicId) {
  const organisationLevel = normalizePermissionLevel(user?.organisationPermissionLevel);

  if (organisationLevel === "admin") {
    return "admin";
  }

  return getClinicPermissionLevel(user, clinicId) || organisationLevel;
}

export function canViewDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "read");
}

export function canDownloadDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "write");
}

export function canUploadDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "write");
}

export function canReplaceDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "write");
}

export function canArchiveDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "manage");
}

export function canRestoreDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "manage");
}

export function canDeleteDocs(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "manage");
}

export function canViewActivity(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "manage");
}

export function canCreateUsers(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "manage");
}

export function canAssignSharedScope(user, clinicId) {
  return hasLevel(getEffectivePermissionLevel(user, clinicId), "admin");
}

export function getAssignablePermissionLevels(user, clinicId) {
  const effectiveLevel = getEffectivePermissionLevel(user, clinicId);

  if (effectiveLevel === "admin") {
    return ["admin", "manage", "write", "read"];
  }

  if (effectiveLevel === "manage") {
    return ["manage", "write", "read"];
  }

  return [];
}

export function getAccessibleDocumentLevels(user, clinicId) {
  const effectiveLevel = getEffectivePermissionLevel(user, clinicId);
  const normalized = normalizePermissionLevel(effectiveLevel);

  if (!normalized) return [];

  return Object.entries(PERMISSION_RANK)
    .filter(([, rank]) => rank <= PERMISSION_RANK[normalized])
    .map(([level]) => level);
}

export function formatPermissionLabel(value) {
  switch (normalizePermissionLevel(value)) {
    case "admin":
      return "Admin";
    case "manage":
      return "Manage";
    case "write":
      return "Write";
    case "read":
      return "Read";
    default:
      return "Unknown";
  }
}