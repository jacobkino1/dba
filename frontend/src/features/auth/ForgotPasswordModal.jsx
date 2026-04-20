import { useState } from "react";

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");

  if (!isOpen) return null;

  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Forgot Password</h2>
            <p style={styles.subtitle}>
              Password reset email is not connected yet.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <form style={styles.body} onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div style={styles.infoBox}>
            For now, password reset email delivery has not been connected.
            Please contact your clinic manager or system administrator to start
            a password reset.
          </div>

          <div style={styles.footer}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
    maxWidth: "520px",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
    transition:
      "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
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
  body: {
    padding: "22px 28px 24px 28px",
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
  infoBox: {
    background: "rgba(59,130,246,0.10)",
    border: "1px solid rgba(96,165,250,0.20)",
    color: "var(--avatar-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "4px",
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