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
                <div style={styles.role}>
                    {isUser ? "You" : "Dental Buddy AI"}
                </div>


                <div style={message.isTyping ? styles.typingText : styles.content}>
                    {isUser ? (
                        <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                    ) : (
                        <div style={styles.markdown}>
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => (
                                        <div style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>
                                            {children}
                                        </div>
                                    ),
                                    h2: ({ children }) => (
                                        <div style={{ fontSize: "17px", fontWeight: "600", marginTop: "16px", marginBottom: "10px" }}>
                                            {children}
                                        </div>
                                    ),
                                    p: ({ children }) => (
                                        <div style={{ marginBottom: "10px" }}>{children}</div>
                                    ),
                                    ol: ({ children }) => (
                                        <ol style={{ paddingLeft: "18px", marginBottom: "12px" }}>{children}</ol>
                                    ),
                                    ul: ({ children }) => (
                                        <ul style={{ paddingLeft: "18px", marginBottom: "12px" }}>{children}</ul>
                                    ),
                                    li: ({ children }) => (
                                        <li style={{ marginBottom: "6px" }}>{children}</li>
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
        border: "1px solid #1f2937",
        lineHeight: "1.6",
        maxWidth: "680px",
        boxSizing: "border-box",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
    },


    hoveredMessage: {
        transform: "translateY(-2px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
    },


    userMessage: {
        background: "#1e293b",
    },


    aiMessage: {
        background: "#0f172a",
        border: "1px solid rgba(59,130,246,0.25)",
        boxShadow: "0 0 18px rgba(59,130,246,0.35)",
    },


    role: {
        fontSize: "12px",
        color: "#94a3b8",
        marginBottom: "10px",
        fontWeight: "600",
    },


    content: {
        fontSize: "15px",
        color: "#e5e7eb",
    },


    typingText: {
        color: "#93c5fd",
        fontStyle: "italic",
    },


    markdown: {
        color: "#e5e7eb",
        fontSize: "15px",
        lineHeight: "1.7",
    },
};
