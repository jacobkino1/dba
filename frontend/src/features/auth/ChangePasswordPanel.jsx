import { useState } from "react";
import { changePassword } from "./api/authApi";

export default function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    if (!newPassword.trim()) {
      setError("New password is required.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
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
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Change Password</h2>
          <p style={styles.subtitle}>
            Update your password for Dental Buddy AI.
          </p>
        </div>
      </div>

      <form style={styles.form} onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={styles.input}
            disabled={isSaving}
            autoComplete="current-password"
            placeholder="Enter current password"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
            disabled={isSaving}
            autoComplete="new-password"
            placeholder="Enter new password"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
            disabled={isSaving}
            autoComplete="new-password"
            placeholder="Confirm new password"
          />
        </div>

        <div style={styles.helperText}>
          Passwords must be at least 8 characters long.
        </div>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {successMessage ? (
          <div style={styles.successBox}>{successMessage}</div>
        ) : null}

        <div style={styles.footer}>
          <button
            type="submit"
            style={{
              ...styles.primaryButton,
              ...(isSaving ? styles.primaryButtonDisabled : {}),
            }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "18px",
    boxShadow: "var(--shadow-soft)",
    overflow: "hidden",
  },
  header: {
    padding: "20px 20px 16px 20px",
    borderBottom: "1px solid var(--divider)",
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  subtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  form: {
    padding: "20px",
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
  helperText: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  errorBox: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "var(--danger-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  successBox: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.28)",
    color: "#16a34a",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "4px",
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
};