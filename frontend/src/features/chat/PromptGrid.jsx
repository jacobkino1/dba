import PromptCard from "./PromptCard";

export default function PromptGrid({
  prompts = [],
  setPrompt,
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <div style={styles.grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} style={styles.skeletonCard}>
            <div style={styles.skeletonLineShort} />
            <div style={styles.skeletonLineLong} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {prompts.map((prompt, index) => (
        <PromptCard
          key={`${prompt.title}-${index}`}
          title={prompt.title}
          subtitle={prompt.subtitle}
          promptText={prompt.promptText}
          onClick={setPrompt}
        />
      ))}
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "18px",
    width: "100%",
  },
  skeletonCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--icon-bubble-border)",
    borderRadius: "16px",
    minHeight: "104px",
    padding: "20px",
    boxSizing: "border-box",
  },
  skeletonLineShort: {
    width: "48%",
    height: "14px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.16)",
    marginBottom: "12px",
  },
  skeletonLineLong: {
    width: "78%",
    height: "12px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.12)",
  },
};