import PromptGrid from "./PromptGrid";


export default function EmptyState({ setPrompt }) {
  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        <h1 style={styles.title}>Ask Dental Buddy AI</h1>


        <p style={styles.subtitle}>
          How can I assist your clinic today?
        </p>


        <PromptGrid setPrompt={setPrompt} />
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
  container: {
    width: "100%",
    maxWidth: "1100px",
    paddingTop: "28px",
  },
  title: {
    fontSize: "34px",
    fontWeight: "700",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "16px",
    marginBottom: "28px",
  },
};
