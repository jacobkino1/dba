import { useEffect, useRef, useState } from "react";


export default function ChatComposer({ prompt, setMessages }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);


  useEffect(() => {
    if (prompt) {
      setInput(prompt);
      inputRef.current?.focus();
    }
  }, [prompt]);


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


    try {
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organisationId: "aa0938dd-55ff-4169-8aa2-6d59e9e0a5c4",
          clinicId: "52e46361-3012-491c-a2ab-c2b898352975",
          roleAccess: "staff",
          question: question,
          topK: 5,
        }),
      });


      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }


      const data = await response.json();
      const answer = data.answer || "No answer returned from backend.";


      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.isTyping);
        return [...withoutTyping, { role: "assistant", content: "" }];
      });


      const words = answer.split(" ");
      let index = 0;


      const interval = setInterval(() => {
        index++;


        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];


          if (last && last.role === "assistant") {
            last.content = words.slice(0, index).join(" ");
          }


          return updated;
        });


        if (index >= words.length) {
          clearInterval(interval);
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
  container: {
    width: "100%",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxSizing: "border-box",
  },
  icon: {
    fontSize: "18px",
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "white",
    fontSize: "15px",
  },
  button: {
    background: "#2563eb",
    border: "none",
    padding: "8px 16px",
    borderRadius: "10px",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
};
