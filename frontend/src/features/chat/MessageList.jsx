import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function MessageList({ messages }) {
  return (
    <div style={styles.outer}>
      <div style={styles.wrapper}>
        {messages.map((message, index) => (
          <HoverMessage key={index} message={message} />
        ))}
      </div>
    </div>
  );
}

function HoverMessage({ message }) {
  const [isHovered, setIsHovered] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      style={{
        ...styles.row,
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          ...styles.message,
          ...(isUser ? styles.userMessage : styles.aiMessage),
          ...(isHovered ? styles.hoveredMessage : {}),
        }}
      >
        <div style={styles.role}>{isUser ? "You" : "Dental Buddy AI"}</div>

        <div style={message.isTyping ? styles.typingText : styles.content}>
          {isUser ? (
            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
          ) : (
            <div style={styles.markdown}>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <div style={styles.h1}>{children}</div>
                  ),
                  h2: ({ children }) => (
                    <div style={styles.h2}>{children}</div>
                  ),
                  p: ({ children }) => <div style={styles.p}>{children}</div>,
                  ol: ({ children }) => (
                    <ol style={styles.ol}>{children}</ol>
                  ),
                  ul: ({ children }) => (
                    <ul style={styles.ul}>{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li style={styles.li}>{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong style={styles.strong}>{children}</strong>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  outer: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },
  wrapper: {
    width: "100%",
    maxWidth: "900px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  row: {
    display: "flex",
    width: "100%",
  },
  message: {
    padding: "16px 18px",
    borderRadius: "16px",
    border: "1px solid var(--border-strong)",
    lineHeight: "1.6",
    maxWidth: "680px",
    boxSizing: "border-box",
    transition:
      "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease",
  },
  hoveredMessage: {
    transform: "translateY(-2px)",
    boxShadow: "var(--shadow-soft)",
  },
  userMessage: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
  },
  aiMessage: {
    background: "var(--surface-1)",
    border: "1px solid var(--icon-bubble-border)",
    boxShadow: "0 0 14px rgba(59,130,246,0.12)",
  },
  role: {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginBottom: "10px",
    fontWeight: "600",
  },
  content: {
    fontSize: "15px",
    color: "var(--text-primary)",
  },
  typingText: {
    color: "var(--avatar-text)",
    fontStyle: "italic",
    fontSize: "15px",
  },
  markdown: {
    color: "var(--text-primary)",
    fontSize: "15px",
    lineHeight: "1.7",
  },
  h1: {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "var(--text-primary)",
  },
  h2: {
    fontSize: "17px",
    fontWeight: "600",
    marginTop: "16px",
    marginBottom: "10px",
    color: "var(--text-primary)",
  },
  p: {
    marginBottom: "10px",
    color: "var(--text-primary)",
  },
  ol: {
    paddingLeft: "18px",
    marginBottom: "12px",
    color: "var(--text-primary)",
  },
  ul: {
    paddingLeft: "18px",
    marginBottom: "12px",
    color: "var(--text-primary)",
  },
  li: {
    marginBottom: "6px",
    color: "var(--text-primary)",
  },
  strong: {
    color: "var(--text-primary)",
    fontWeight: "700",
  },
};