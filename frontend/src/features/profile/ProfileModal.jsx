import { useMemo, useState } from "react";
import { changePassword } from "../auth/api/authApi";

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  clinics = [],
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

  const clinicNameMap = useMemo(() => {
    const map = {};
    for (const clinic of clinics) {
      map[clinic.clinicId] = clinic.name;
    }
    return map;
  }, [clinics]);

  if (!isOpen || !currentUser) return null;

  const memberships = Array.isArray(currentUser.clinicMemberships)
    ? currentUser.clinicMemberships
    : [];

  const isOrganisationUser = !!currentUser.organisationPermissionLevel;
  const accountType = String(currentUser.accountType || "").toLowerCase();
  const isWorkstation = accountType === "workstation";

  const identityLabel = isWorkstation
    ? currentUser.username || "Workstation account"
    : currentUser.email || "user@example.com";

  const accountTypeLabel = isWorkstation ? "Workstation account" : "Work account";

  function resetPasswordFormState() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
  }

  function handleOpenPasswordForm() {
    setError("");
    setSuccessMessage("");
    setIsPasswordFormOpen(true);
  }

  function handleClosePasswordForm() {
    if (isSaving) return;
    resetPasswordFormState();
    setIsPasswordFormOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSaving(true);

      await changePassword({
        currentPassword,
        newPassword,
      });

      setSuccessMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        setIsPasswordFormOpen(false);
        setSuccessMessage("");
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Profile</h2>
            <p style={styles.subtitle}>
              {isWorkstation
                ? "View this workstation account and manage its password."
                : "Manage your account details and password."}
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.body} className="dba-scroll">
          <div style={styles.identityCard}>
            <div style={styles.identityLeft}>
              <div style={styles.avatar}>{getInitials(currentUser.displayName)}</div>

              <div style={styles.identityTextWrap}>
                <div style={styles.identityName}>
                  {currentUser.displayName || "User"}
                </div>
                <div style={styles.identityEmail}>{identityLabel}</div>

                <div style={styles.identityMetaRow}>
                  <span style={styles.metaBadge}>{accountTypeLabel}</span>

                  <span style={styles.metaBadgeSecondary}>
                    {isOrganisationUser ? "Organisation access" : "Clinic access"}
                  </span>

                  <span style={styles.metaBadgeSecondary}>
                    {isOrganisationUser
                      ? formatPermission(currentUser.organisationPermissionLevel)
                      : `${memberships.length} clinic${memberships.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Selected Clinic</div>
              <div style={styles.summaryValue}>
                {clinicNameMap[currentUser.selectedClinicId] ||
                  currentUser.selectedClinicId ||
                  "None"}
              </div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Effective Permission</div>
              <div style={styles.summaryValue}>
                {formatPermission(currentUser.effectivePermissionLevel) || "—"}
              </div>
            </div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>Clinic Access</div>
              <div style={styles.sectionSubtitle}>
                {isWorkstation
                  ? "This shared device account can access the following clinics."
                  : "Your access across this workspace."}
              </div>
            </div>

            {isOrganisationUser ? (
              <div style={styles.membershipList}>
                <div style={styles.membershipItem}>
                  <div style={styles.membershipText}>
                    <div style={styles.membershipTitle}>All clinics</div>
                    <div style={styles.membershipSubtitle}>
                      Organisation-level access across this workspace
                    </div>
                  </div>

                  <span style={styles.permissionBadge}>
                    {formatPermission(currentUser.organisationPermissionLevel)}
                  </span>
                </div>
              </div>
            ) : memberships.length === 0 ? (
              <div style={styles.emptyText}>No clinic memberships found.</div>
            ) : (
              <div style={styles.membershipList}>
                {memberships.map((membership) => (
                  <div
                    key={`${membership.clinicId}-${membership.permissionLevel}`}
                    style={styles.membershipItem}
                  >
                    <div style={styles.membershipText}>
                      <div style={styles.membershipTitle}>
                        {clinicNameMap[membership.clinicId] || membership.clinicId}
                      </div>
                      <div style={styles.membershipSubtitle}>Clinic access</div>
                    </div>

                    <span style={styles.permissionBadge}>
                      {formatPermission(membership.permissionLevel)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div style={styles.passwordHeaderRow}>
                <div>
                  <div style={styles.sectionTitle}>Change Password</div>
                  <div style={styles.sectionSubtitle}>
                    {isWorkstation
                      ? "Update the password for this workstation account."
                      : "Update your password for Dental Buddy AI."}
                  </div>
                </div>

                {!isPasswordFormOpen && (
                  <button
                    type="button"
                    style={styles.inlinePrimaryButton}
                    onClick={handleOpenPasswordForm}
                  >
                    Change Password
                  </button>
                )}
              </div>
            </div>

            {!isPasswordFormOpen ? (
              <div style={styles.collapsedPasswordBody}>
                <div style={styles.collapsedPasswordText}>
                  {isWorkstation
                    ? "This workstation password is hidden for security. Click the button above to update it."
                    : "Your password is hidden for security. Click the button above to update it."}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={styles.input}
                    autoComplete="current-password"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                    autoComplete="new-password"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={styles.input}
                    autoComplete="new-password"
                  />
                </div>

                <div style={styles.helpText}>Use at least 8 characters.</div>

                {error ? <div style={styles.errorBox}>{error}</div> : null}
                {successMessage ? (
                  <div style={styles.successBox}>{successMessage}</div>
                ) : null}

                <div style={styles.footer}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleClosePasswordForm}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    style={styles.primaryButton}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
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

function formatPermission(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "admin") return "Admin";
  if (normalized === "manage") return "Manage";
  if (normalized === "write") return "Write";
  if (normalized === "read") return "Read";
  if (!value) return "";

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
    zIndex: 1400,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  modal: {
    width: "100%",
    maxWidth: "860px",
    height: "min(860px, calc(100vh - 48px))",
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
    flex: 1,
    minHeight: 0,
    padding: "22px 28px 32px 28px",
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
    fontSize: "20px",
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  summaryCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "16px",
  },
  summaryLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
  },
  summaryValue: {
    marginTop: "8px",
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  sectionCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    overflow: "hidden",
    flexShrink: 0,
  },
  sectionHeader: {
    padding: "18px 20px 14px 20px",
    borderBottom: "1px solid var(--divider)",
  },
  sectionTitle: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
  },
  sectionSubtitle: {
    marginTop: "6px",
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  passwordHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  membershipList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "18px 20px 20px 20px",
  },
  membershipItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "14px 16px",
  },
  membershipText: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  membershipTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  membershipSubtitle: {
    color: "var(--text-muted)",
    fontSize: "12px",
  },
  permissionBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "var(--icon-bubble-bg)",
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "600",
    flexShrink: 0,
    border: "1px solid var(--icon-bubble-border)",
  },
  emptyText: {
    padding: "18px 20px 20px 20px",
    color: "var(--text-muted)",
    fontSize: "14px",
  },
  collapsedPasswordBody: {
    padding: "18px 20px 20px 20px",
  },
  collapsedPasswordText: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  form: {
    padding: "18px 20px 20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
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
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  helpText: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  errorBox: {
    background: "rgba(127, 29, 29, 0.18)",
    border: "1px solid rgba(248, 113, 113, 0.28)",
    color: "var(--danger-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  successBox: {
    background: "rgba(20, 83, 45, 0.18)",
    border: "1px solid rgba(74, 222, 128, 0.28)",
    color: "#16a34a",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
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
  inlinePrimaryButton: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
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
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
};