import { useEffect, useRef, useState } from "react";
import { ASK_URL, buildJsonHeaders } from "../../config/api";

export default function ChatComposer({
  prompt,
  setPrompt,
  setMessages,
  selectedClinicName,
  activeConversationId,
  onCreateConversation,
  onPersistConversationMessage,
}) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const typingIntervalRef = useRef(null);

  const canPersistHistory =
    typeof onCreateConversation === "function" &&
    typeof onPersistConversationMessage === "function";

  useEffect(() => {
    if (prompt) {
      setInput(prompt);
      inputRef.current?.focus();

      if (typeof setPrompt === "function") {
        setPrompt("");
      }
    }
  }, [prompt, setPrompt]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

  async function handleAsk() {
    if (!input.trim() || isLoading) return;

    const question = input.trim();

    const userMessage = {
      role: "user",
      content: question,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        role: "assistant",
        content: "Typing...",
        isTyping: true,
      },
    ]);

    setInput("");
    setIsLoading(true);

    let conversationId = canPersistHistory ? activeConversationId || "" : "";

    try {
      if (canPersistHistory && !conversationId) {
        const createdConversation = await onCreateConversation(question);
        conversationId = createdConversation?.conversationId || "";
      }

      if (canPersistHistory && !conversationId) {
        throw new Error("Conversation could not be created");
      }

      if (canPersistHistory) {
        await onPersistConversationMessage(conversationId, "user", question, null);
      }

      const headers = buildJsonHeaders();

      const response = await fetch(ASK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question,
          topK: 5,
          conversationId: canPersistHistory ? conversationId : null,
        }),
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            `Request failed with status ${response.status}`
        );
      }

      const answer = data?.answer || "No answer returned from backend.";
      const sourceJson = JSON.stringify(data?.sources || []);

      if (canPersistHistory) {
        await onPersistConversationMessage(
          conversationId,
          "assistant",
          answer,
          sourceJson
        );
      }

      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.isTyping);
        return [...withoutTyping, { role: "assistant", content: "" }];
      });

      const words = answer.split(" ");
      let index = 0;

      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      typingIntervalRef.current = setInterval(() => {
        index += 1;

        setMessages((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;

          const updated = [...prev];
          const last = updated[updated.length - 1];

          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: words.slice(0, index).join(" "),
            };
          }

          return updated;
        });

        if (index >= words.length) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, 40);
    } catch (error) {
      const errorMessage = {
        role: "assistant",
        content: `Error talking to backend: ${error.message}`,
      };

      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.isTyping);
        return [...withoutTyping, errorMessage];
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAsk();
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.inner}>
        <div style={styles.contextLabel}>
          {selectedClinicName
            ? `Answers are based on ${selectedClinicName} and shared documents`
            : "Answers are based on the selected clinic and shared documents"}
        </div>

        <div style={styles.container}>
          <span style={styles.icon}>🦷</span>

          <input
            ref={inputRef}
            type="text"
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything to help with patient care, procedures, or admin tasks..."
            disabled={isLoading}
          />

          <button
            type="button"
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {}),
            }}
            onClick={handleAsk}
            disabled={isLoading}
          >
            {isLoading ? "Thinking..." : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },
  inner: {
    width: "100%",
    maxWidth: "980px",
  },
  contextLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    marginBottom: "10px",
    paddingLeft: "4px",
  },
  container: {
    width: "100%",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "16px",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxSizing: "border-box",
    transition:
      "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
    boxShadow: "var(--shadow-soft)",
  },
  icon: {
    fontSize: "18px",
    lineHeight: 1,
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontSize: "15px",
  },
  button: {
    background: "var(--accent-solid)",
    border: "none",
    padding: "8px 16px",
    borderRadius: "10px",
    color: "#ffffff",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
    transition: "opacity 160ms ease, transform 160ms ease",
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
};