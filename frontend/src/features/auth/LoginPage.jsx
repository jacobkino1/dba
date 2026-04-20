import { useState } from "react";
import { login, loginWorkstation } from "./api/authApi";
import { setAccessToken } from "./authStorage";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function LoginPage({ onLoginSuccess }) {
  const [loginType, setLoginType] = useState("work"); // work | workstation
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPasswordValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (loginType === "work") {
      if (!email.trim()) {
        setError("Email is required.");
        return;
      }
    } else {
      if (!username.trim()) {
        setError("Username is required.");
        return;
      }
    }

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      setIsSaving(true);

      const result =
        loginType === "work"
          ? await login({
              email: email.trim(),
              password,
            })
          : await loginWorkstation({
              username: username.trim(),
              password,
            });

      setAccessToken(result.accessToken);

      await onLoginSuccess?.(result);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brandRow}>
            <div style={styles.brandIcon}>🦷</div>
            <div>
              <h1 style={styles.title}>Dental Buddy AI</h1>
              <p style={styles.subtitle}>
                Sign in to access your clinic workspace.
              </p>
            </div>
          </div>

          <div style={styles.segmentedControl}>
            <button
              type="button"
              onClick={() => {
                setLoginType("work");
                setError("");
              }}
              style={{
                ...styles.segmentButton,
                ...(loginType === "work" ? styles.segmentButtonActive : {}),
              }}
            >
              Work Account
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginType("workstation");
                setError("");
              }}
              style={{
                ...styles.segmentButton,
                ...(loginType === "workstation"
                  ? styles.segmentButtonActive
                  : {}),
              }}
            >
              Workstation
            </button>
          </div>

          <form style={styles.form} onSubmit={handleSubmit}>
            {loginType === "work" ? (
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  disabled={isSaving}
                  placeholder="Enter your email"
                  autoComplete="email"
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
                  disabled={isSaving}
                  placeholder="Enter workstation username"
                  autoComplete="username"
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                style={styles.input}
                disabled={isSaving}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {loginType === "work" ? (
              <div style={styles.linkRow}>
                <button
                  type="button"
                  style={styles.linkButton}
                  onClick={() => setIsForgotPasswordOpen(true)}
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <div style={styles.infoBox}>
                Workstation accounts are shared clinic devices and do not keep
                personal chat history.
              </div>
            )}

            {error ? <div style={styles.errorBox}>{error}</div> : null}

            <button
              type="submit"
              style={{
                ...styles.primaryButton,
                ...(isSaving ? styles.primaryButtonDisabled : {}),
              }}
              disabled={isSaving}
            >
              {isSaving ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </>
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
  segmentedControl: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "6px",
    marginBottom: "18px",
  },
  segmentButton: {
    border: "none",
    borderRadius: "12px",
    padding: "11px 12px",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 160ms ease, color 160ms ease",
  },
  segmentButtonActive: {
    background: "var(--surface-3)",
    color: "var(--text-primary)",
  },
  form: {
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
  linkRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "-4px",
  },
  linkButton: {
    background: "transparent",
    border: "none",
    color: "var(--avatar-text)",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    padding: 0,
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
  errorBox: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "var(--danger-text)",
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