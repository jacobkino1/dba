const items = ["Chat", "History", "Clinic Docs", "Settings"];


export default function Sidebar() {
  return (
    <aside style={styles.sidebar}>
      {items.map((item, index) => (
        <div
          key={item}
          style={{
            ...styles.item,
            ...(index === 0 ? styles.activeItem : {}),
          }}
        >
          {item}
        </div>
      ))}
    </aside>
  );
}


const styles = {
  sidebar: {
    width: "240px",
    background: "#0f172a",
    borderRight: "1px solid #1f2937",
    padding: "20px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  item: {
    padding: "14px 16px",
    borderRadius: "12px",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  activeItem: {
    background: "#1e293b",
    color: "#ffffff",
    fontWeight: "600",
  },
};
