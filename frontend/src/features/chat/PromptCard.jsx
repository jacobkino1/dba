import { useState } from "react";

export default function PromptCard({
  title,
  subtitle,
  promptText,
  onClick,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.card,
        ...(isHovered ? styles.cardHover : {}),
      }}
      onClick={() => onClick(promptText || title)}
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
    background: "var(--surface-1)",
    border: "1px solid var(--icon-bubble-border)",
    borderRadius: "16px",
    minHeight: "104px",
    padding: "20px 20px",
    cursor: "pointer",
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    boxSizing: "border-box",
    transition:
      "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease",
  },
  cardHover: {
    transform: "translateY(-2px)",
    border: "1px solid var(--table-action-hover-border)",
    boxShadow: "var(--shadow-soft)",
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
    color: "var(--text-primary)",
    lineHeight: 1.35,
  },
  subtitle: {
    fontSize: "13px",
    color: "var(--text-muted)",
    marginTop: "6px",
    lineHeight: 1.4,
  },
};