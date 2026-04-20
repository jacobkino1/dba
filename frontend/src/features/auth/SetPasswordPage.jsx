import { useState } from "react";
import { setPassword } from "./api/authApi";

export default function SetPasswordPage({
  email = "",
  onPasswordSet,
}) {
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email) {
      setError("Email is missing for this account.");
      return;
    }

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    try {
      setIsSaving(true);

      await setPassword({
        email,
        password,
      });

      setSuccessMessage("Password set successfully.");
      setPasswordValue("");
      setConfirmPassword("");

      await onPasswordSet?.();
    } catch (err) {
      setError(err.message || "Failed to set password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.brandIcon}>🦷</div>
          <div>
            <h1 style={styles.title}>Set Password</h1>
            <p style={styles.subtitle}>
              Create a password to continue into Dental Buddy AI.
            </p>
          </div>
        </div>

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.infoBox}>
            Your password must be at least 8 characters long.
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              style={styles.readOnlyInput}
              disabled
              readOnly
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              style={styles.input}
              disabled={isSaving}
              placeholder="Enter a new password"
              autoComplete="new-password"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              disabled={isSaving}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}
          {successMessage ? (
            <div style={styles.successBox}>{successMessage}</div>
          ) : null}

          <button
            type="submit"
            style={{
              ...styles.primaryButton,
              ...(isSaving ? styles.primaryButtonDisabled : {}),
            }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--app-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    transition: "background 160ms ease",
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    background: "var(--card-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "24px",
    padding: "28px",
    boxSizing: "border-box",
    boxShadow: "var(--shadow-strong)",
    transition:
      "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
  },
  brandRow: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "22px",
  },
  brandIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    background: "var(--icon-bubble-bg)",
    border: "1px solid var(--icon-bubble-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "28px",
    fontWeight: "700",
  },
  subtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
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
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  readOnlyInput: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-muted)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
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
  primaryButton: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 16px",
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