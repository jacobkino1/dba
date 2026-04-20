export default function ClinicSelectorPage({
  currentUser,
  clinics,
  onSelectClinic,
  isLoading = false,
}) {
  const clinicCount = Array.isArray(clinics) ? clinics.length : 0;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Select Clinic</h1>
        <p style={styles.subtitle}>
          {currentUser?.displayName
            ? `Welcome ${currentUser.displayName}. Choose the clinic you want to access.`
            : "Choose the clinic you want to access."}
        </p>

        {clinicCount === 0 ? (
          <div style={styles.emptyState}>
            No clinics are available for your account.
          </div>
        ) : (
          <div style={styles.list}>
            {clinics.map((clinic) => (
              <button
                key={clinic.clinicId}
                type="button"
                onClick={() => onSelectClinic?.(clinic)}
                disabled={isLoading}
                style={styles.clinicButton}
              >
                <div style={styles.clinicName}>{clinic.name}</div>
              </button>
            ))}
          </div>
        )}
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
    maxWidth: "620px",
    background: "var(--card-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "20px",
    padding: "28px",
    boxSizing: "border-box",
    boxShadow: "var(--shadow-soft)",
    transition:
      "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
  },
  title: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "28px",
    fontWeight: "700",
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: "22px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  emptyState: {
    padding: "16px",
    borderRadius: "14px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    color: "var(--text-secondary)",
    fontSize: "14px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  clinicButton: {
    width: "100%",
    textAlign: "left",
    padding: "16px 18px",
    borderRadius: "14px",
    border: "1px solid var(--border-strong)",
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    cursor: "pointer",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
  },
  clinicName: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
};