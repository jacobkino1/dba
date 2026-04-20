export default function Sidebar({ activeView, setActiveView, currentUser }) {
  const orgLevel = String(
    currentUser?.organisationPermissionLevel || ""
  ).toLowerCase();

  const effectiveLevel = String(
    currentUser?.effectivePermissionLevel || ""
  ).toLowerCase();

  const accountType = String(currentUser?.accountType || "").toLowerCase();
  const isWorkstation = accountType === "workstation";

  const canManageUsers =
    orgLevel === "admin" || ["admin", "manage"].includes(effectiveLevel);

  const canViewInsights =
    orgLevel === "admin" || ["admin", "manage"].includes(effectiveLevel);

  const items = [
    "Chat",
    ...(isWorkstation ? [] : ["History"]),
    ...(canViewInsights ? ["Insights"] : []),
    "Clinic Docs",
    ...(canManageUsers ? ["Users"] : []),
    "Settings",
  ];

  return (
    <aside style={styles.sidebar}>
      {items.map((item) => {
        const isActive = activeView === item;

        return (
          <button
            key={item}
            type="button"
            onClick={() => setActiveView(item)}
            style={{
              ...styles.item,
              ...(isActive ? styles.activeItem : {}),
            }}
          >
            {item}
          </button>
        );
      })}
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "240px",
    background: "var(--sidebar-bg)",
    borderRight: "1px solid var(--border-strong)",
    padding: "20px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    boxSizing: "border-box",
    transition: "background 160ms ease, border-color 160ms ease",
  },
  item: {
    padding: "14px 16px",
    borderRadius: "12px",
    color: "var(--text-secondary)",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    textAlign: "left",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background 160ms ease, color 160ms ease",
  },
  activeItem: {
    background: "var(--surface-3)",
    color: "var(--text-primary)",
    fontWeight: "600",
  },
};