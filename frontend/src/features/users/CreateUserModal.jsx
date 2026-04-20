import { useEffect, useMemo, useState } from "react";
import { createUser } from "./api/usersApi";

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

export default function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
  currentUser,
  availableClinics = [],
}) {
  const [accountType, setAccountType] = useState("work"); // work | workstation
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState("clinic");
  const [permissionLevel, setPermissionLevel] = useState("read");
  const [clinicAccessRows, setClinicAccessRows] = useState([
    createClinicAccessRow("", "read"),
  ]);
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

  const isWorkstation = accountType === "workstation";

  const identityPrimaryText = displayName.trim() || "New User";
  const identitySecondaryText = isWorkstation
    ? username.trim() || "workstation-username"
    : email.trim() || "user@example.com";

  useEffect(() => {
    if (!isOpen) {
      setAccountType("work");
      setDisplayName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setScope("clinic");
      setPermissionLevel("read");
      setClinicAccessRows([createClinicAccessRow("", "read")]);
      setApplyAllPermissionLevel("read");
      setIsSaving(false);
      setError("");
      return;
    }
  }, [isOpen]);

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
    }
  }, [accountType, applyAllPermissionLevel, isWorkstation, permissionLevel, scope]);

  useEffect(() => {
    if (isWorkstation) return;

    if (!canAssignOrganisationScope && scope === "organisation") {
      setScope("clinic");
    }
  }, [canAssignOrganisationScope, isWorkstation, scope]);

  useEffect(() => {
    if (scope !== "organisation" || isWorkstation) return;

    if (!assignablePermissionLevels.includes(permissionLevel)) {
      setPermissionLevel(
        assignablePermissionLevels[assignablePermissionLevels.length - 1] ||
          "read"
      );
    }
  }, [assignablePermissionLevels, isWorkstation, permissionLevel, scope]);

  if (!isOpen) return null;

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

    setClinicAccessRows(createUniqueClinicAccessRows(availableClinics, nextPermission));
  }

  function clearAllClinicAccessRows() {
    setClinicAccessRows([createClinicAccessRow("", "read")]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }

    if (accountType === "work") {
      if (!trimmedEmail) {
        setError("Email is required.");
        return;
      }

      if (scope === "organisation") {
        try {
          setIsSaving(true);

          const createdUser = await createUser({
            displayName: trimmedDisplayName,
            accountType: "work",
            email: trimmedEmail,
            scope: "organisation",
            permissionLevel,
          });

          if (typeof onCreated === "function") {
            await onCreated(createdUser);
          }

          onClose();
        } catch (err) {
          setError(err.message || "Failed to create user.");
        } finally {
          setIsSaving(false);
        }

        return;
      }

      const cleanedClinicAccess = clinicAccessRows
        .map((row) => ({
          clinicId: String(row.clinicId || "").trim(),
          permissionLevel: normalizePermission(row.permissionLevel),
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

        const createdUser = await createUser({
          displayName: trimmedDisplayName,
          accountType: "work",
          email: trimmedEmail,
          scope: "clinic",
          clinicAccess: cleanedClinicAccess,
        });

        if (typeof onCreated === "function") {
          await onCreated(createdUser);
        }

        onClose();
      } catch (err) {
        setError(err.message || "Failed to create user.");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    if (!trimmedUsername) {
      setError("Username is required for workstation accounts.");
      return;
    }

    if (!trimmedPassword) {
      setError("Password is required for workstation accounts.");
      return;
    }

    const cleanedClinicAccess = clinicAccessRows
      .map((row) => ({
        clinicId: String(row.clinicId || "").trim(),
        permissionLevel: "read",
      }))
      .filter((row) => row.clinicId);

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

      const createdUser = await createUser({
        displayName: trimmedDisplayName,
        accountType: "workstation",
        username: trimmedUsername,
        password: trimmedPassword,
        scope: "clinic",
        clinicAccess: cleanedClinicAccess,
      });

      if (typeof onCreated === "function") {
        await onCreated(createdUser);
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to create workstation account.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Create User</h2>
            <p style={styles.subtitle}>
              Add a work user or a shared workstation account.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <form style={styles.body} onSubmit={handleSubmit}>
          <div style={styles.accountTypeCard}>
            <div style={styles.accountTypeHeader}>
              <div style={styles.sectionTitle}>Account Type</div>
              <div style={styles.sectionSubtitle}>
                Choose how this account signs in and behaves in the app.
              </div>
            </div>

            <div style={styles.segmentedWrap}>
              <button
                type="button"
                onClick={() => setAccountType("work")}
                disabled={isSaving}
                style={{
                  ...styles.segmentButton,
                  ...(accountType === "work" ? styles.segmentButtonActive : {}),
                }}
              >
                <span style={styles.segmentTitle}>Work</span>
                <span style={styles.segmentSubtext}>Email-based account</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountType("workstation")}
                disabled={isSaving}
                style={{
                  ...styles.segmentButton,
                  ...(accountType === "workstation"
                    ? styles.segmentButtonActive
                    : {}),
                }}
              >
                <span style={styles.segmentTitle}>Workstation</span>
                <span style={styles.segmentSubtext}>Shared clinic device</span>
              </button>
            </div>

            {isWorkstation ? (
              <div style={styles.infoBox}>
                Workstation accounts are shared device logins. They are clinic-only,
                read-only, and do not keep personal chat history.
              </div>
            ) : (
              <div style={styles.infoBox}>
                Work accounts are for real people and use email-based identity.
              </div>
            )}
          </div>

          <div style={styles.identityCard}>
            <div style={styles.identityLeft}>
              <div style={styles.avatar}>{getInitials(identityPrimaryText)}</div>

              <div style={styles.identityTextWrap}>
                <div style={styles.identityName}>{identityPrimaryText}</div>
                <div style={styles.identityEmail}>{identitySecondaryText}</div>

                <div style={styles.identityMetaRow}>
                  <span style={styles.metaBadge}>
                    {isWorkstation ? "Workstation account" : "Work account"}
                  </span>
                  <span style={styles.metaBadgeSecondary}>
                    {scope === "organisation" ? "Organisation scope" : "Clinic scope"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.gridTwo}>
            <div style={styles.field}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={styles.input}
                placeholder={
                  isWorkstation ? "e.g. Front Desk Workstation" : "e.g. Jane Smith"
                }
                disabled={isSaving}
              />
            </div>

            {accountType === "work" ? (
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  placeholder="e.g. jane@example.com"
                  disabled={isSaving}
                />
              </div>
            ) : (
              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={styles.input}
                  placeholder="e.g. frontdesk01"
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          {isWorkstation && (
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter a password for this workstation"
                disabled={isSaving}
              />
              <div style={styles.helpText}>
                This password is used directly by the shared workstation account.
              </div>
            </div>
          )}

          <div style={styles.scopeCard}>
            <div style={styles.scopeHeader}>
              <div style={styles.sectionTitle}>Access Scope</div>
              <div style={styles.sectionSubtitle}>
                Choose whether this account is managed at clinic or organisation level.
              </div>
            </div>

            <div style={styles.scopeSegmentWrap}>
              <button
                type="button"
                onClick={() => setScope("clinic")}
                disabled={isSaving}
                style={{
                  ...styles.scopeSegmentButton,
                  ...(scope === "clinic" ? styles.scopeSegmentButtonActive : {}),
                }}
              >
                Clinic
              </button>

              {!isWorkstation && canAssignOrganisationScope && (
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

            {isWorkstation && (
              <div style={styles.scopeLockText}>
                Workstation accounts are always clinic-scoped.
              </div>
            )}
          </div>

          {scope === "organisation" && !isWorkstation ? (
            <div style={styles.field}>
              <label style={styles.label}>Permission</label>
              <select
                value={permissionLevel}
                onChange={(e) => setPermissionLevel(e.target.value)}
                style={styles.select}
                disabled={isSaving}
              >
                {assignablePermissionLevels.map((level) => (
                  <option key={level} value={level}>
                    {formatPermission(level)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={styles.accessSection}>
              <div>
                <div style={styles.accessSectionTitle}>Clinic Access</div>
                <div style={styles.accessSectionSubtitle}>
                  {isWorkstation
                    ? "Choose which clinics this shared workstation can access. Permission is always Read."
                    : "Give this user a separate permission level for each clinic."}
                </div>
              </div>

              <div style={styles.quickSetupCard}>
                <div style={styles.quickSetupHeader}>
                  <div style={styles.quickSetupTitle}>Quick setup</div>
                  <div style={styles.quickSetupSubtitle}>
                    Fill all clinics quickly, then adjust individual rows if needed.
                  </div>
                </div>

                <div style={styles.quickSetupActions}>
                  {!isWorkstation ? (
                    <select
                      value={applyAllPermissionLevel}
                      onChange={(e) => setApplyAllPermissionLevel(e.target.value)}
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
                    Set access row by row.
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
                          e.currentTarget.style.boxShadow = "var(--shadow-soft)";
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
                              disabled={isSaving || clinicAccessRows.length === 1}
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
          )}

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
              {isSaving
                ? "Creating..."
                : isWorkstation
                ? "Create Workstation"
                : "Create User"}
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
    maxWidth: "900px",
    maxHeight: "calc(100vh - 48px)",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "28px",
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
    fontSize: "24px",
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
    fontSize: "18px",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "10px",
  },
  body: {
    padding: "22px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    overflowY: "auto",
  },
  accountTypeCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "20px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  accountTypeHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sectionTitle: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  segmentedWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  segmentButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    background: "var(--surface-1)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "14px 16px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
  },
  segmentButtonActive: {
    background: "rgba(37,99,235,0.14)",
    color: "var(--avatar-text)",
    border: "1px solid var(--table-action-hover-border)",
    boxShadow: "0 0 0 1px rgba(96,165,250,0.08) inset",
  },
  segmentTitle: {
    fontSize: "14px",
    fontWeight: "700",
  },
  segmentSubtext: {
    fontSize: "12px",
    lineHeight: 1.4,
    opacity: 0.92,
  },
  infoBox: {
    background: "rgba(59,130,246,0.10)",
    border: "1px solid rgba(96,165,250,0.20)",
    color: "var(--avatar-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  identityCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "20px",
    padding: "18px",
  },
  identityLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  avatar: {
    width: "56px",
    height: "56px",
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
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  scopeCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "20px",
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
  scopeLockText: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
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
  input: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
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
  helpText: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
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
    borderRadius: "20px",
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
};