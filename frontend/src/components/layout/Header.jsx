export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <span style={styles.logo}>🦷</span>
        <span style={styles.title}>Dental Buddy AI</span>
      </div>


      <div style={styles.right}>
        <span style={styles.workspace}>Dentists in Annerley</span>
        <span style={styles.avatar}>👤</span>
      </div>
    </header>
  );
}


const styles = {
  header: {
    height: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10, 15, 30, 0.72)",
    color: "#ffffff",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  left: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  logo: {
    fontSize: "24px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
  },
  workspace: {
    fontSize: "14px",
    color: "#cbd5e1",
  },
  avatar: {
    fontSize: "20px",
  },
};
