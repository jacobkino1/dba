import { useEffect, useMemo, useState } from "react";
import { updateUserAccess } from "./api/usersApi";

function createClinicAccessRow(clinicId = "", permissionLevel = "read") {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clinicId,
    permissionLevel,
  };
}

function createUniqueClinicAccessRows(clinics = [], permissionLevel = "read") {
  return clinics.map((clinic) =>
    createClinicAccessRow(clinic.clinicId, permissionLevel)
  );
}

function getAccountType(user) {
  return String(user?.accountType || "work").toLowerCase();
}

function isWorkstationAccount(user) {
  return getAccountType(user) === "workstation";
}

function getUserIdentity(user) {
  return isWorkstationAccount(user)
    ? user?.username || "—"
    : user?.email || "—";
}

function getAccountTypeLabel(user) {
  return isWorkstationAccount(user) ? "Workstation" : "Work";
}

export default function EditUserAccessModal({
  isOpen,
  onClose,
  onSaved,
  currentUser,
  user,
  availableClinics = [],
  isProtectedOrganisationAdmin = false,
}) {
  const [scope, setScope] = useState("clinic");
  const [permissionLevel, setPermissionLevel] = useState("read");
  const [clinicAccessRows, setClinicAccessRows] = useState([]);
  const [applyAllPermissionLevel, setApplyAllPermissionLevel] = useState("read");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const actorOrgPermission = String(
    currentUser?.organisationPermissionLevel || ""
  ).toLowerCase();

  const actorEffectivePermission = String(
    currentUser?.effectivePermissionLevel || ""
  ).toLowerCase();

  const canAssignOrganisationScope = actorOrgPermission === "admin";

  const assignablePermissionLevels = useMemo(() => {
    if (actorOrgPermission === "admin") {
      return ["admin", "manage", "write", "read"];
    }

    if (actorEffectivePermission === "manage") {
      return ["manage", "write", "read"];
    }

    return [];
  }, [actorEffectivePermission, actorOrgPermission]);

  const isWorkstation = isWorkstationAccount(user);

  const isProtectedOrgAdmin =
    !isWorkstation &&
    isProtectedOrganisationAdmin &&
    String(user?.organisationPermissionLevel || "").toLowerCase() === "admin" &&
    String(user?.status || "").toLowerCase() === "active";

  const isScopeLockedToOrganisation = isProtectedOrgAdmin;
  const isPermissionLockedToAdmin = isProtectedOrgAdmin;

  useEffect(() => {
    if (!isOpen || !user) {
      setScope("clinic");
      setPermissionLevel("read");
      setClinicAccessRows([]);
      setApplyAllPermissionLevel("read");
      setIsSaving(false);
      setError("");
      return;
    }

    if (isWorkstation) {
      const memberships = Array.isArray(user.clinicMemberships)
        ? user.clinicMemberships
        : [];

      setScope("clinic");
      setPermissionLevel("read");
      setClinicAccessRows(
        memberships.length > 0
          ? memberships.map((item) =>
              createClinicAccessRow(item.clinicId, "read")
            )
          : [createClinicAccessRow("", "read")]
      );
      setApplyAllPermissionLevel("read");
      setIsSaving(false);
      setError("");
      return;
    }

    const hasOrgRole = !!user.organisationPermissionLevel;

    if (hasOrgRole) {
      setScope("organisation");
      setPermissionLevel(normalizePermission(user.organisationPermissionLevel));
      setClinicAccessRows([]);
    } else {
      const memberships = Array.isArray(user.clinicMemberships)
        ? user.clinicMemberships
        : [];

      setScope("clinic");
      setPermissionLevel("read");
      setClinicAccessRows(
        memberships.length > 0
          ? memberships.map((item) =>
              createClinicAccessRow(
                item.clinicId,
                normalizePermission(item.permissionLevel)
              )
            )
          : [createClinicAccessRow("", "read")]
      );
    }

    setApplyAllPermissionLevel("read");
    setIsSaving(false);
    setError("");
  }, [isOpen, user, isWorkstation]);

  useEffect(() => {
    if (isWorkstation) {
      if (scope !== "clinic") {
        setScope("clinic");
      }

      if (permissionLevel !== "read") {
        setPermissionLevel("read");
      }

      if (applyAllPermissionLevel !== "read") {
        setApplyAllPermissionLevel("read");
      }

      setClinicAccessRows((prev) =>
        prev.map((row) => ({
          ...row,
          permissionLevel: "read",
        }))
      );

      return;
    }

    if (!canAssignOrganisationScope && scope === "organisation") {
      setScope("clinic");
    }
  }, [
    canAssignOrganisationScope,
    isWorkstation,
    scope,
    permissionLevel,
    applyAllPermissionLevel,
  ]);

  useEffect(() => {
    if (scope !== "organisation" || isWorkstation) return;

    if (!assignablePermissionLevels.includes(permissionLevel)) {
      setPermissionLevel(
        assignablePermissionLevels[assignablePermissionLevels.length - 1] ||
          "read"
      );
    }
  }, [assignablePermissionLevels, isWorkstation, permissionLevel, scope]);

  useEffect(() => {
    if (!isOpen || !user || !isProtectedOrgAdmin) return;

    if (scope !== "organisation") {
      setScope("organisation");
    }

    if (permissionLevel !== "admin") {
      setPermissionLevel("admin");
    }
  }, [isOpen, user, isProtectedOrgAdmin, scope, permissionLevel]);

  if (!isOpen || !user) return null;

  function addClinicAccessRow() {
    setClinicAccessRows((prev) => [...prev, createClinicAccessRow("", "read")]);
  }

  function removeClinicAccessRow(rowId) {
    setClinicAccessRows((prev) => prev.filter((row) => row.rowId !== rowId));
  }

  function updateClinicAccessRow(rowId, field, value) {
    setClinicAccessRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              [field]:
                isWorkstation && field === "permissionLevel" ? "read" : value,
            }
          : row
      )
    );
  }

  function isClinicAlreadySelected(clinicId, currentRowId) {
    return clinicAccessRows.some(
      (row) => row.rowId !== currentRowId && row.clinicId === clinicId
    );
  }

  function applyPermissionToAllClinics() {
    if (availableClinics.length === 0) return;

    const nextPermission = isWorkstation ? "read" : applyAllPermissionLevel;

    setClinicAccessRows(
      createUniqueClinicAccessRows(availableClinics, nextPermission)
    );
  }

  function clearAllClinicAccessRows() {
    setClinicAccessRows([createClinicAccessRow("", "read")]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isProtectedOrgAdmin) {
      if (scope !== "organisation") {
        setError(
          "The last active organisation admin must remain organisation scoped."
        );
        return;
      }

      if (normalizePermission(permissionLevel) !== "admin") {
        setError(
          "The last active organisation admin must keep Admin permission."
        );
        return;
      }
    }

    if (!isWorkstation && scope === "organisation") {
      try {
        setIsSaving(true);

        const updatedUser = await updateUserAccess({
          userId: user.userId,
          scope: "organisation",
          permissionLevel,
        });

        if (typeof onSaved === "function") {
          await onSaved(updatedUser);
        }

        onClose();
      } catch (err) {
        setError(err.message || "Failed to update access.");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    const cleanedClinicAccess = clinicAccessRows
      .map((row) => ({
        clinicId: String(row.clinicId || "").trim(),
        permissionLevel: isWorkstation
          ? "read"
          : normalizePermission(row.permissionLevel),
      }))
      .filter((row) => row.clinicId && row.permissionLevel);

    if (cleanedClinicAccess.length === 0) {
      setError("Add at least one clinic access row.");
      return;
    }

    const seenClinicIds = new Set();

    for (const item of cleanedClinicAccess) {
      if (seenClinicIds.has(item.clinicId)) {
        setError("Each clinic can only be added once.");
        return;
      }

      seenClinicIds.add(item.clinicId);
    }

    try {
      setIsSaving(true);

      const updatedUser = await updateUserAccess({
        userId: user.userId,
        scope: "clinic",
        clinicAccess: cleanedClinicAccess,
      });

      if (typeof onSaved === "function") {
        await onSaved(updatedUser);
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to update access.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Edit Access</h2>
            <p style={styles.subtitle}>
              Update this user&apos;s permission and clinic access.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <form style={styles.body} onSubmit={handleSubmit}>
          <div style={styles.identityCard}>
            <div style={styles.identityLeft}>
              <div style={styles.avatar}>{getInitials(user.displayName)}</div>

              <div style={styles.identityTextWrap}>
                <div style={styles.identityName}>{user.displayName}</div>
                <div style={styles.identityEmail}>{getUserIdentity(user)}</div>

                <div style={styles.identityMetaRow}>
                  <span style={styles.metaBadge}>
                    {isWorkstation
                      ? "Workstation account"
                      : user.organisationPermissionLevel
                      ? "Organisation user"
                      : "Clinic user"}
                  </span>

                  <span style={styles.metaBadgeSecondary}>
                    {getAccountTypeLabel(user)} account
                  </span>

                  <span style={styles.metaBadgeSecondary}>
                    {user.organisationPermissionLevel
                      ? formatPermission(user.organisationPermissionLevel)
                      : `${Array.isArray(user.clinicMemberships)
                          ? user.clinicMemberships.length
                          : 0} clinic${
                          Array.isArray(user.clinicMemberships) &&
                          user.clinicMemberships.length === 1
                            ? ""
                            : "s"
                        }`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {isWorkstation ? (
            <div style={styles.workstationLockCard}>
              <div style={styles.workstationLockHeader}>
                <div>
                  <div style={styles.workstationLockTitle}>
                    Workstation Rules
                  </div>
                  <div style={styles.workstationLockSubtitle}>
                    Workstation accounts are locked to clinic scope and read-only
                    access.
                  </div>
                </div>

                <div style={styles.workstationLockBadge}>Locked</div>
              </div>

              <div style={styles.workstationLockGrid}>
                <div style={styles.workstationLockItem}>
                  <div style={styles.workstationLockLabel}>Scope</div>
                  <div style={styles.workstationLockValue}>Clinic</div>
                </div>

                <div style={styles.workstationLockItem}>
                  <div style={styles.workstationLockLabel}>Permission</div>
                  <div style={styles.workstationLockValue}>Read</div>
                </div>
              </div>

              <div style={styles.workstationLockNote}>
                You can change which clinics this workstation can access, but not
                its scope or permission level.
              </div>
            </div>
          ) : isProtectedOrgAdmin ? (
            <div style={styles.protectedAccessCard}>
              <div style={styles.protectedAccessHeader}>
                <div>
                  <div style={styles.protectedAccessTitle}>Protected Access</div>
                  <div style={styles.protectedAccessSubtitle}>
                    This account is currently protected by organisation admin
                    safety rules.
                  </div>
                </div>

                <div style={styles.protectedLockBadge}>Locked</div>
              </div>

              <div style={styles.protectedAccessGrid}>
                <div style={styles.protectedAccessItem}>
                  <div style={styles.protectedAccessLabel}>Scope</div>
                  <div style={styles.protectedAccessValue}>Organisation</div>
                </div>

                <div style={styles.protectedAccessItem}>
                  <div style={styles.protectedAccessLabel}>Permission</div>
                  <div style={styles.protectedAccessValue}>Admin</div>
                </div>
              </div>

              <div style={styles.protectedAccessNote}>
                Add or activate another organisation admin before changing this
                user&apos;s organisation scope or admin permission.
              </div>
            </div>
          ) : (
            <>
              <div style={styles.scopeCard}>
                <div style={styles.scopeHeader}>
                  <div style={styles.scopeTitle}>Access Scope</div>
                  <div style={styles.scopeSubtitle}>
                    Choose whether this user is managed at clinic or organisation
                    level.
                  </div>
                </div>

                <div style={styles.scopeSegmentWrap}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isScopeLockedToOrganisation) {
                        setScope("clinic");
                      }
                    }}
                    disabled={isSaving || isScopeLockedToOrganisation}
                    title={
                      isScopeLockedToOrganisation
                        ? "The last active organisation admin cannot be moved to clinic scope."
                        : ""
                    }
                    style={{
                      ...styles.scopeSegmentButton,
                      ...(scope === "clinic"
                        ? styles.scopeSegmentButtonActive
                        : {}),
                      ...(isScopeLockedToOrganisation
                        ? styles.scopeSegmentButtonDisabled
                        : {}),
                    }}
                  >
                    Clinic
                  </button>

                  {canAssignOrganisationScope && (
                    <button
                      type="button"
                      onClick={() => setScope("organisation")}
                      disabled={isSaving}
                      style={{
                        ...styles.scopeSegmentButton,
                        ...(scope === "organisation"
                          ? styles.scopeSegmentButtonActive
                          : {}),
                      }}
                    >
                      Organisation
                    </button>
                  )}
                </div>
              </div>

              {scope === "organisation" ? (
                <div style={styles.field}>
                  <label style={styles.label}>Permission</label>
                  <select
                    value={permissionLevel}
                    onChange={(e) => {
                      if (!isPermissionLockedToAdmin) {
                        setPermissionLevel(e.target.value);
                      }
                    }}
                    style={styles.select}
                    disabled={isSaving || isPermissionLockedToAdmin}
                  >
                    {assignablePermissionLevels.map((level) => {
                      const isDisabled =
                        isPermissionLockedToAdmin &&
                        normalizePermission(level) !== "admin";

                      return (
                        <option key={level} value={level} disabled={isDisabled}>
                          {formatPermission(level)}
                          {isDisabled ? " — unavailable" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}
            </>
          )}

          <div style={styles.accessSection}>
            <div>
              <div style={styles.accessSectionTitle}>Clinic Access</div>
              <div style={styles.accessSectionSubtitle}>
                {isWorkstation
                  ? "Choose which clinics this workstation can access. Permission is always Read."
                  : "Give this user a separate permission level for each clinic."}
              </div>
            </div>

            <div style={styles.quickSetupCard}>
              <div style={styles.quickSetupHeader}>
                <div style={styles.quickSetupTitle}>Quick setup</div>
                <div style={styles.quickSetupSubtitle}>
                  Fill all clinics quickly, then adjust individual rows if
                  needed.
                </div>
              </div>

              <div style={styles.quickSetupActions}>
                {!isWorkstation ? (
                  <select
                    value={applyAllPermissionLevel}
                    onChange={(e) =>
                      setApplyAllPermissionLevel(e.target.value)
                    }
                    style={styles.bulkSelect}
                    disabled={isSaving}
                  >
                    {assignablePermissionLevels.map((level) => (
                      <option key={level} value={level}>
                        {formatPermission(level)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={styles.lockedPill}>Permission: Read only</div>
                )}

                <button
                  type="button"
                  style={styles.bulkActionButton}
                  onClick={applyPermissionToAllClinics}
                  disabled={isSaving || availableClinics.length === 0}
                >
                  Apply to all clinics
                </button>

                <button
                  type="button"
                  style={styles.secondaryInlineButton}
                  onClick={clearAllClinicAccessRows}
                  disabled={isSaving}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div style={styles.assignedSection}>
              <div style={styles.assignedSectionHeader}>
                <div style={styles.assignedSectionTitle}>Assigned clinics</div>
                <div style={styles.assignedSectionSubtitle}>
                  Set or review access row by row.
                </div>
              </div>

              {clinicAccessRows.length === 0 ? (
                <div style={styles.emptyAccessState}>
                  No clinic access rows added yet.
                </div>
              ) : (
                <div style={styles.accessRowsWrap}>
                  {clinicAccessRows.map((row) => (
                    <div
                      key={row.rowId}
                      style={styles.accessRowCard}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.borderColor =
                          "var(--table-action-hover-border)";
                        e.currentTarget.style.boxShadow =
                          "var(--shadow-soft)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor =
                          "var(--border-soft)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={styles.accessRowGrid}>
                        <div style={styles.field}>
                          <label style={styles.label}>Clinic</label>
                          <select
                            value={row.clinicId}
                            onChange={(e) =>
                              updateClinicAccessRow(
                                row.rowId,
                                "clinicId",
                                e.target.value
                              )
                            }
                            style={styles.select}
                            disabled={isSaving}
                          >
                            <option value="">Select a clinic</option>
                            {availableClinics.map((clinic) => {
                              const isTaken = isClinicAlreadySelected(
                                clinic.clinicId,
                                row.rowId
                              );

                              return (
                                <option
                                  key={clinic.clinicId}
                                  value={clinic.clinicId}
                                  disabled={isTaken}
                                >
                                  {clinic.name}
                                  {isTaken ? " — already selected" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div style={styles.field}>
                          <label style={styles.label}>Permission</label>
                          {isWorkstation ? (
                            <div style={styles.lockedField}>Read</div>
                          ) : (
                            <select
                              value={row.permissionLevel}
                              onChange={(e) =>
                                updateClinicAccessRow(
                                  row.rowId,
                                  "permissionLevel",
                                  e.target.value
                                )
                              }
                              style={styles.select}
                              disabled={isSaving}
                            >
                              {assignablePermissionLevels.map((level) => (
                                <option key={level} value={level}>
                                  {formatPermission(level)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div style={styles.rowRemoveWrap}>
                          <button
                            type="button"
                            style={{
                              ...styles.removeRowButton,
                              ...(clinicAccessRows.length === 1
                                ? styles.removeRowButtonDisabled
                                : {}),
                            }}
                            onClick={() => removeClinicAccessRow(row.rowId)}
                            disabled={
                              isSaving || clinicAccessRows.length === 1
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                style={styles.addRowButtonBottom}
                onClick={addClinicAccessRow}
                disabled={isSaving}
              >
                + Add clinic access
              </button>
            </div>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.footer}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isSaving || assignablePermissionLevels.length === 0}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

function normalizePermission(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "admin") return "admin";
  if (normalized === "manage") return "manage";
  if (normalized === "write") return "write";
  if (normalized === "read") return "read";

  return "read";
}

function formatPermission(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "admin") return "Admin";
  if (normalized === "manage") return "Manage";
  if (normalized === "write") return "Write";
  if (normalized === "read") return "Read";

  return value;
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "var(--modal-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  modal: {
    width: "100%",
    maxWidth: "860px",
    maxHeight: "calc(100vh - 48px)",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "24px 28px 18px 28px",
    borderBottom: "1px solid var(--divider)",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  subtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "24px",
    lineHeight: 1,
    cursor: "pointer",
  },
  body: {
    padding: "22px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    overflowY: "auto",
  },
  identityCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "18px",
  },
  identityLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "999px",
    background: "var(--avatar-bg)",
    border: "1px solid var(--avatar-border)",
    color: "var(--avatar-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "700",
    flexShrink: 0,
  },
  identityTextWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  identityName: {
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: 1.3,
  },
  identityEmail: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  identityMetaRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "6px",
  },
  metaBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "var(--icon-bubble-bg)",
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  metaBadgeSecondary: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "var(--surface-2)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    fontSize: "12px",
    fontWeight: "600",
  },
  scopeCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  scopeHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  scopeTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  scopeSubtitle: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  scopeSegmentWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  scopeSegmentButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  scopeSegmentButtonActive: {
    background: "rgba(37,99,235,0.14)",
    color: "var(--avatar-text)",
    border: "1px solid var(--table-action-hover-border)",
    boxShadow: "0 0 0 1px rgba(96,165,250,0.08) inset",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-secondary)",
  },
  select: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  lockedField: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-secondary)",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: "600",
  },
  lockedPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "rgba(37,99,235,0.14)",
    color: "var(--avatar-text)",
    border: "1px solid var(--table-action-hover-border)",
    fontSize: "13px",
    fontWeight: "700",
  },
  accessSection: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  accessSectionTitle: {
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: "700",
  },
  accessSectionSubtitle: {
    marginTop: "6px",
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  quickSetupCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  quickSetupHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  quickSetupTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  quickSetupSubtitle: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  quickSetupActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  bulkSelect: {
    minWidth: "150px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "12px",
    color: "var(--text-primary)",
    padding: "10px 12px",
    fontSize: "13px",
    outline: "none",
  },
  bulkActionButton: {
    background: "rgba(37,99,235,0.14)",
    color: "var(--avatar-text)",
    border: "1px solid var(--table-action-hover-border)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryInlineButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  assignedSection: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  assignedSectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  assignedSectionTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  assignedSectionSubtitle: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  accessRowsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  accessRowCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "16px",
    transition:
      "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
    transform: "translateY(0)",
  },
  accessRowGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr auto",
    gap: "14px",
    alignItems: "end",
  },
  rowRemoveWrap: {
    display: "flex",
    alignItems: "flex-end",
  },
  removeRowButton: {
    background: "transparent",
    color: "var(--danger-text)",
    border: "1px solid rgba(244,63,94,0.22)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    height: "44px",
  },
  removeRowButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  addRowButtonBottom: {
    alignSelf: "flex-start",
    background: "transparent",
    color: "var(--avatar-text)",
    border: "1px solid var(--table-action-hover-border)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  emptyAccessState: {
    background: "var(--surface-1)",
    border: "1px dashed var(--border-soft)",
    borderRadius: "16px",
    padding: "18px",
    color: "var(--text-muted)",
    fontSize: "14px",
  },
  errorBox: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "var(--danger-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "6px",
  },
  primaryButton: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  secondaryButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  scopeSegmentButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  protectedAccessCard: {
    background:
      "linear-gradient(180deg, rgba(245,158,11,0.08) 0%, rgba(15,23,42,0.08) 100%)",
    border: "1px solid rgba(251,191,36,0.22)",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  protectedAccessHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  protectedAccessTitle: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
  },
  protectedAccessSubtitle: {
    marginTop: "6px",
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  protectedLockBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(251,191,36,0.12)",
    border: "1px solid rgba(251,191,36,0.22)",
    color: "#b45309",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  protectedAccessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  protectedAccessItem: {
    background: "rgba(255,255,255,0.45)",
    border: "1px solid rgba(251,191,36,0.16)",
    borderRadius: "14px",
    padding: "14px",
  },
  protectedAccessLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
  },
  protectedAccessValue: {
    marginTop: "6px",
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  protectedAccessNote: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  workstationLockCard: {
    background:
      "linear-gradient(180deg, rgba(124,58,237,0.08) 0%, rgba(15,23,42,0.08) 100%)",
    border: "1px solid rgba(168,85,247,0.20)",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  workstationLockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  workstationLockTitle: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
  },
  workstationLockSubtitle: {
    marginTop: "6px",
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  workstationLockBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(168,85,247,0.14)",
    border: "1px solid rgba(168,85,247,0.22)",
    color: "#7c3aed",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  workstationLockGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  workstationLockItem: {
    background: "rgba(255,255,255,0.45)",
    border: "1px solid rgba(168,85,247,0.16)",
    borderRadius: "14px",
    padding: "14px",
  },
  workstationLockLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
  },
  workstationLockValue: {
    marginTop: "6px",
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  workstationLockNote: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};