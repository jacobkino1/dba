import { useMemo, useState } from "react";
import { resetUserPassword } from "./api/usersApi";

export default function ResetPasswordModal({
  user,
  onClose,
  onResetComplete,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const accountType = String(user?.accountType || "work").toLowerCase();
  const isWorkstation = accountType === "workstation";

  const identityLabel = isWorkstation ? "Username" : "Email";
  const identityValue = isWorkstation
    ? user?.username || "—"
    : user?.email || "—";

  const modalTitle = isWorkstation
    ? "Reset Workstation Password"
    : "Reset Password";

  const modalSubtitle = isWorkstation
    ? "Generate a new password for this shared workstation account."
    : "Prepare this work account for password reset. Email reset delivery is not connected yet.";

  const infoMessage = useMemo(() => {
    if (isWorkstation) {
      return "This will generate a new workstation password. Copy it and store it safely before closing this window.";
    }

    return "This is currently a placeholder flow. Password reset email delivery is not connected yet.";
  }, [isWorkstation]);

  if (!user) return null;

  async function handleConfirm() {
    try {
      setIsSaving(true);
      setError("");
      setGeneratedPassword("");
      setSuccessMessage("");
      setIsCopied(false);

      const result = await resetUserPassword({
        targetUserId: user.userId,
      });

      const returnedPassword =
        result?.temporaryPassword || result?.password || "";

      if (isWorkstation) {
        if (returnedPassword) {
          setGeneratedPassword(returnedPassword);
          setSuccessMessage("New workstation password generated.");
        } else {
          setSuccessMessage(
            "Workstation password reset completed, but no generated password was returned by the backend."
          );
        }
      } else {
        setSuccessMessage(
          "Password reset started. The user must set a new password."
        );
      }

      if (typeof onResetComplete === "function") {
        await onResetComplete(user, result);
      }
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyPassword() {
    if (!generatedPassword) return;

    try {
      await navigator.clipboard.writeText(generatedPassword);
      setIsCopied(true);

      window.setTimeout(() => {
        setIsCopied(false);
      }, 1600);
    } catch {
      setError("Could not copy the password. Please copy it manually.");
    }
  }

  function handleClose() {
    if (isSaving) return;
    onClose?.();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{modalTitle}</h2>
            <p style={styles.subtitle}>{modalSubtitle}</p>
          </div>

          <button type="button" style={styles.closeButton} onClick={handleClose}>
            ✕
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.identityCard}>
            <div style={styles.identityLeft}>
              <div style={styles.avatar}>{getInitials(user.displayName)}</div>

              <div style={styles.identityTextWrap}>
                <div style={styles.identityName}>{user.displayName}</div>
                <div style={styles.identityValue}>{identityValue}</div>

                <div style={styles.identityMetaRow}>
                  <span style={styles.metaBadge}>
                    {isWorkstation ? "Workstation account" : "Work account"}
                  </span>
                  <span style={styles.metaBadgeSecondary}>
                    {String(user.status || "").toLowerCase() === "invited"
                      ? "Invited"
                      : String(user.status || "").toLowerCase() === "disabled"
                      ? "Disabled"
                      : "Active"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.userCard}>
            <div style={styles.userLabel}>Display Name</div>
            <div style={styles.userValue}>{user.displayName}</div>

            <div style={{ ...styles.userLabel, marginTop: "12px" }}>
              {identityLabel}
            </div>
            <div style={styles.userValue}>{identityValue}</div>
          </div>

          <div style={styles.infoBox}>{infoMessage}</div>

          {generatedPassword ? (
            <div style={styles.passwordCard}>
              <div style={styles.passwordCardHeader}>
                <div>
                  <div style={styles.passwordTitle}>New workstation password</div>
                  <div style={styles.passwordSubtitle}>
                    Copy this now. It may not be shown again.
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.copyButton,
                    ...(isCopied ? styles.copyButtonSuccess : {}),
                  }}
                  onClick={handleCopyPassword}
                >
                  {isCopied ? "Copied" : "Copy"}
                </button>
              </div>

              <div style={styles.passwordValueWrap}>
                <code style={styles.passwordValue}>{generatedPassword}</code>
              </div>
            </div>
          ) : null}

          {successMessage ? (
            <div style={styles.successBox}>{successMessage}</div>
          ) : null}

          {error ? <div style={styles.errorBox}>{error}</div> : null}
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleClose}
            disabled={isSaving}
          >
            {generatedPassword || successMessage ? "Close" : "Cancel"}
          </button>

          {!generatedPassword && (
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(isSaving ? styles.primaryButtonDisabled : {}),
              }}
              onClick={handleConfirm}
              disabled={isSaving}
            >
              {isSaving
                ? isWorkstation
                  ? "Generating..."
                  : "Resetting..."
                : isWorkstation
                ? "Generate New Password"
                : "Reset Password"}
            </button>
          )}
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

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "var(--modal-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1300,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  modal: {
    width: "100%",
    maxWidth: "640px",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "28px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
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
  body: {
    padding: "22px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
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
  identityValue: {
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
  userCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "16px",
  },
  userLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontWeight: "600",
  },
  userValue: {
    marginTop: "6px",
    fontSize: "14px",
    color: "var(--text-primary)",
    fontWeight: "600",
    wordBreak: "break-word",
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
  passwordCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  passwordCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  passwordTitle: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
  },
  passwordSubtitle: {
    marginTop: "6px",
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  passwordValueWrap: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "14px 16px",
    overflowX: "auto",
  },
  passwordValue: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
    wordBreak: "break-all",
  },
  copyButton: {
    background: "transparent",
    color: "var(--avatar-text)",
    border: "1px solid var(--table-action-hover-border)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  copyButtonSuccess: {
    background: "rgba(34,197,94,0.12)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.24)",
  },
  successBox: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.28)",
    color: "#16a34a",
    borderRadius: "14px",
    padding: "12px 14px",
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
    padding: "0 28px 24px 28px",
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
  primaryButtonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
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
  closeButton: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "10px",
  },
};