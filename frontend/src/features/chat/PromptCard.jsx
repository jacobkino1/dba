import { useState } from "react";


export default function PromptCard({ title, subtitle, onClick }) {
  const [isHovered, setIsHovered] = useState(false);


  return (
    <div
      style={{
        ...styles.card,
        ...(isHovered ? styles.cardHover : {}),
      }}
      onClick={() => onClick(title)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.icon}>🦷</div>


      <div style={styles.content}>
        <div style={styles.title}>{title}</div>
        {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}


const styles = {
  card: {
    background: "rgba(15, 23, 42, 0.92)",
    border: "1px solid rgba(59,130,246,0.14)",
    borderRadius: "16px",
    minHeight: "104px",
    padding: "20px 20px",
    cursor: "pointer",
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    boxSizing: "border-box",
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border 0.18s ease",
  },
  cardHover: {
    transform: "translateY(-2px)",
    border: "1px solid rgba(59,130,246,0.3)",
    boxShadow: "0 0 18px rgba(59,130,246,0.18)",
  },
  icon: {
    fontSize: "18px",
    lineHeight: 1.2,
    marginTop: "2px",
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: "600",
    fontSize: "15px",
    color: "#f8fafc",
    lineHeight: 1.35,
  },
  subtitle: {
    fontSize: "13px",
    color: "#94a3b8",
    marginTop: "6px",
    lineHeight: 1.4,
  },
};
