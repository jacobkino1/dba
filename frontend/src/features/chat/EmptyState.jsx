import { useEffect, useMemo, useState } from "react";
import PromptGrid from "./PromptGrid";
import { listDocuments } from "../docs/api/docsApi";

const FALLBACK_PROMPTS = [
  {
    title: "Create a recall message",
    subtitle: "for a recent patient visit",
    promptText: "Create a recall message for a recent patient visit.",
  },
  {
    title: "Summarize patient note",
    subtitle: "into a quick clinic summary",
    promptText: "Summarize this patient note into a quick clinic summary.",
  },
  {
    title: "Draft a treatment plan overview",
    subtitle: "in simple clinic language",
    promptText: "Draft a treatment plan overview in simple clinic language.",
  },
  {
    title: "Draft a treatment plan",
    subtitle: "based on the available information",
    promptText: "Draft a treatment plan based on the available information.",
  },
  {
    title: "Explain a dental procedure",
    subtitle: "in a clear patient-friendly way",
    promptText: "Explain a dental procedure in a clear patient-friendly way.",
  },
  {
    title: "Answer a patient question",
    subtitle: "using clinic-approved guidance",
    promptText: "Answer a patient question using clinic-approved guidance.",
  },
];

export default function EmptyState({ setPrompt, selectedClinicName }) {
  const [documents, setDocuments] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      try {
        setIsLoadingSuggestions(true);
        const docs = await listDocuments();

        if (!isMounted) return;
        setDocuments(Array.isArray(docs) ? docs : []);
      } catch {
        if (!isMounted) return;
        setDocuments([]);
      } finally {
        if (isMounted) {
          setIsLoadingSuggestions(false);
        }
      }
    }

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, []);

  const generatedPrompts = useMemo(() => {
    const usableDocs = documents
      .filter((doc) => {
        const status = String(doc?.status || "").toLowerCase();
        return status === "active";
      })
      .filter((doc) => {
        const readiness = String(doc?.readiness || "").toLowerCase();
        return (
          readiness === "good for dba" ||
          readiness === "usable with warnings" ||
          readiness === ""
        );
      });

    if (usableDocs.length === 0) {
      return FALLBACK_PROMPTS;
    }

    const candidatePrompts = [];

    usableDocs.forEach((doc) => {
      const rawName = String(doc?.filename || "document").trim();
      const cleanName = stripFileExtension(rawName);
      const shortName = shortenTitle(cleanName, 42);
      const docType = String(doc?.documentType || "").trim().toLowerCase();

      candidatePrompts.push(
        {
          title: `Summarize ${shortName}`,
          subtitle: "get the key points quickly",
          promptText: `Summarize the document "${cleanName}".`,
        },
        {
          title: `Steps in ${shortName}`,
          subtitle: "pull out the main process",
          promptText: `What are the main steps in the document "${cleanName}"?`,
        }
      );

      if (looksLikePolicy(docType, cleanName)) {
        candidatePrompts.push({
          title: `Responsibilities in ${shortName}`,
          subtitle: "see who does what",
          promptText: `Who is responsible according to the document "${cleanName}"?`,
        });
      }

      if (looksLikeProcedure(docType, cleanName)) {
        candidatePrompts.push({
          title: `Checklist from ${shortName}`,
          subtitle: "turn the process into actions",
          promptText: `Turn the document "${cleanName}" into a practical checklist.`,
        });
      }

      if (looksLikeReporting(cleanName)) {
        candidatePrompts.push({
          title: `Who should be notified?`,
          subtitle: `based on ${shortName}`,
          promptText: `Who should be notified according to the document "${cleanName}"?`,
        });
      }
    });

    const deduped = dedupePrompts(candidatePrompts);
    const shuffled = shuffleArray(deduped);

    return shuffled.slice(0, 6).length > 0
      ? shuffled.slice(0, 6)
      : FALLBACK_PROMPTS;
  }, [documents]);

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        <h1 style={styles.title}>Ask Dental Buddy AI</h1>

        <p style={styles.subtitle}>
          {selectedClinicName
            ? `Suggested prompts for ${selectedClinicName}, based on available clinic documents.`
            : "Suggested prompts based on available clinic documents."}
        </p>

        <PromptGrid
          prompts={generatedPrompts}
          setPrompt={setPrompt}
          isLoading={isLoadingSuggestions}
        />
      </div>
    </div>
  );
}

function stripFileExtension(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function shortenTitle(value, maxLength = 42) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function looksLikePolicy(documentType, name) {
  const value = `${documentType} ${name}`.toLowerCase();
  return value.includes("policy") || value.includes("responsib");
}

function looksLikeProcedure(documentType, name) {
  const value = `${documentType} ${name}`.toLowerCase();
  return (
    value.includes("procedure") ||
    value.includes("process") ||
    value.includes("workflow") ||
    value.includes("sterilis") ||
    value.includes("infection") ||
    value.includes("consent")
  );
}

function looksLikeReporting(name) {
  const value = String(name || "").toLowerCase();
  return (
    value.includes("incident") ||
    value.includes("report") ||
    value.includes("notification") ||
    value.includes("escalat") ||
    value.includes("complaint")
  );
}

function dedupePrompts(prompts) {
  const seen = new Set();
  const output = [];

  prompts.forEach((item) => {
    const key = String(item.promptText || item.title || "")
      .toLowerCase()
      .trim();
    if (!key || seen.has(key)) return;

    seen.add(key);
    output.push(item);
  });

  return output;
}

function shuffleArray(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
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
    color: "var(--text-primary)",
  },
  subtitle: {
    color: "var(--text-muted)",
    fontSize: "16px",
    marginBottom: "28px",
    lineHeight: 1.5,
  },
};