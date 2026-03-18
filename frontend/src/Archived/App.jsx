import { useEffect, useState } from "react";

const ORGANISATION_ID = "aa0938dd-55ff-4169-8aa2-6d59e9e0a5c4"
const CLINIC_ID = "52e46361-3012-491c-a2ab-c2b898352975"

export default function App() {
  const [apiStatus, setApiStatus] = useState("Checking API...");
  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [docs, setDocs] = useState([]);

  const [question, setQuestion] = useState("");
  const [askMsg, setAskMsg] = useState("");
  const [sources, setSources] = useState([]);

  const loadDocs = () => {
    fetch(
      `http://127.0.0.1:8000/docs/list?organisationId=${ORGANISATION_ID}&clinicId=${CLINIC_ID}`
    )
      .then((r) => r.json())
      .then((data) => setDocs(data.documents || []))
      .catch(() => setDocs([]));
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((r) => r.json())
      .then((data) => setApiStatus(`✅ API Connected: ${data.service} (${data.status})`))
      .catch(() => setApiStatus("❌ API Not reachable"));

    loadDocs();
  }, []);

  const upload = async () => {
    if (!file) return;

    setUploadMsg("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `http://127.0.0.1:8000/docs/upload?organisationId=${ORGANISATION_ID}&clinicId=${CLINIC_ID}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      setUploadMsg("❌ Upload failed");
      return;
    }

    const data = await res.json();
    setUploadMsg(`✅ Uploaded: ${data.filename}`);
    setFile(null);
    loadDocs();
  };

  const ingest = async (documentId) => {
    const res = await fetch("http://127.0.0.1:8000/docs/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });

    const data = await res.json();

    if (data.status !== "ingested") {
      alert(`❌ Ingest failed: ${data.message || "unknown error"}`);
      return;
    }

    alert(`✅ Ingested ${data.filename} (${data.chunks} chunks)`);
  };

  const ask = async () => {
    if (!question.trim()) return;

    setAskMsg("Searching...");
    setSources([]);

    const res = await fetch("http://127.0.0.1:8000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationId: ORGANISATION_ID,
        clinicId: CLINIC_ID,
        roleAccess: "staff",
        question,
        topK: 5,
      }),
    });

    if (!res.ok) {
      setAskMsg("❌ Ask failed");
      return;
    }

    const data = await res.json();

    setAskMsg(`✅ Found ${data.sources?.length || 0} source chunks`);
    setSources(data.sources || []);
  };

  return (
    <div style={{ fontFamily: "Arial", padding: 24, maxWidth: 1000 }}>
      <h1>Dental Buddy AI (Local MVP)</h1>
      <p>{apiStatus}</p>

      <hr style={{ margin: "24px 0" }} />

      <h2>Manager: Upload Documents</h2>
      <p style={{ marginTop: 0, color: "#555" }}>
        Supported for ingestion: <b>PDF (text-based)</b> and <b>DOCX</b>. If a PDF is scanned, it won’t extract text yet.
      </p>

      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button style={{ marginLeft: 12 }} onClick={upload}>Upload</button>
      <p>{uploadMsg}</p>

      <h3>Documents</h3>
      {docs.length === 0 ? (
        <p>No documents yet.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>File</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Type</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Role</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Source</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.documentId}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{d.filename}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{d.documentType}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{d.roleAccess}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{d.sourceType}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <button onClick={() => ingest(d.documentId)}>Ingest</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Staff: Ask a Question</h2>
      <input
        style={{ width: "100%", padding: 10, fontSize: 16 }}
        placeholder="Ask about SOPs, policies, infection control..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button style={{ marginTop: 12 }} onClick={ask}>Ask</button>
      <p>{askMsg}</p>

      {sources.length > 0 && (
        <>
          <h3>Sources (Top Chunks)</h3>
          {sources.map((s, idx) => (
            <div key={idx} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "#444" }}>
                <b>{s.filename}</b> — chunk {s.chunkIndex} — score {String(s.score).slice(0, 6)}
              </div>
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{s.text}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
