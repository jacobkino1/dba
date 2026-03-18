import PromptCard from "./PromptCard";


const prompts = [
  {
    title: "Create a recall message",
    subtitle: "for a recent patient visit",
  },
  { title: "Summarize patient note" },
  { title: "Draft a treatment plan overview" },
  { title: "Draft a treatment plan" },
  { title: "Explain a dental procedure" },
  { title: "Answer a patient question" },
];


export default function PromptGrid({ setPrompt }) {
  return (
    <div style={styles.grid}>
      {prompts.map((prompt, index) => (
        <PromptCard
          key={index}
          title={prompt.title}
          subtitle={prompt.subtitle}
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
};
