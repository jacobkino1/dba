import { useEffect, useRef, useState } from "react";
import EmptyState from "../../features/chat/EmptyState";
import ChatComposer from "../../features/chat/ChatComposer";
import MessageList from "../../features/chat/MessageList";


export default function MainPanel() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const contentRef = useRef(null);


  const hasMessages = messages.length > 0;


  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);


  return (
    <main style={styles.main}>
      <div ref={contentRef} style={styles.contentArea}>
        {!hasMessages ? (
          <EmptyState setPrompt={setPrompt} />
        ) : (
          <MessageList messages={messages} />
        )}
      </div>


      <div style={styles.composerArea}>
        <ChatComposer prompt={prompt} setMessages={setMessages} />
      </div>
    </main>
  );
}


const styles = {
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    background: "#020617",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  contentArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "48px 56px 24px 56px",
    boxSizing: "border-box",
  },
  composerArea: {
    flexShrink: 0,
    padding: "0 56px 24px 56px",
    boxSizing: "border-box",
    background: "#020617",
  },
};
