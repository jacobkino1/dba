import os
import re
import uuid
from pathlib import Path
from typing import List, Optional


from dotenv import load_dotenv
load_dotenv()


from database.db import engine
from database.models import Base
from sqlalchemy.orm import Session
from database.db import SessionLocal
from database.models import Document


from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


from qdrant_client import QdrantClient
from qdrant_client.http import models as qm


from pypdf import PdfReader
from docx import Document as DocxDocument
from openai import AzureOpenAI




AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")


CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")
EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")


azure_client = AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
)


Base.metadata.create_all(bind=engine)




def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




UPLOAD_ROOT = Path(r"C:\dev\dba-mvp\data\uploads")
QDRANT_URL = "http://localhost:6333"
COLLECTION = "dba_docs"


app = FastAPI(title="DBA MVP API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Qdrant setup --------
qdrant = QdrantClient(url=QDRANT_URL)
VECTOR_SIZE = 1536




def ensure_collection():
    existing = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION not in existing:
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=qm.VectorParams(
                size=VECTOR_SIZE,
                distance=qm.Distance.COSINE,
            ),
        )




ensure_collection()




# -------- Helpers --------
def normalize_line(text: str) -> str:
    return " ".join(text.strip().split())




def fallback_chunk_text(text: str, chunk_size: int = 1800, overlap: int = 400) -> List[str]:
    text = normalize_line(text)
    chunks = []
    i = 0
    while i < len(text):
        chunk = text[i:i + chunk_size]
        chunks.append(chunk)
        i += max(1, chunk_size - overlap)
    return chunks




def is_step_heading(line: str) -> bool:
    line = normalize_line(line)
    return bool(re.match(r"^step\s+\d+\b", line, flags=re.IGNORECASE))




def extract_step_number_from_heading(line: str) -> Optional[str]:
    match = re.match(r"^step\s+(\d+)\b", normalize_line(line), flags=re.IGNORECASE)
    if match:
        return match.group(1)
    return None




def is_section_heading(line: str) -> bool:
    line = normalize_line(line)
    lower = line.lower()


    known_headings = {
        "overview",
        "goal",
        "purpose",
        "scope",
        "procedure",
        "procedures",
        "reporting",
        "notification",
        "notify",
        "responsibilities",
        "responsibility",
        "key behaviours",
        "key behavior",
        "tools and supports",
        "tools & supports",
        "definitions",
        "references",
        "follow up",
        "follow-up",
        "medical follow-up",
        "documentation",
        "documentation and follow-up",
        "preventive measures",
    }


    if lower in known_headings:
        return True


    # short title-like headings only
    if len(line) <= 50 and line == line.title():
        return True


    return False




def extract_text_from_file(path: Path) -> str:
    ext = path.suffix.lower()


    if ext == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")


    if ext == ".pdf":
        reader = PdfReader(str(path))
        pages = []
        for p in reader.pages:
            pages.append(p.extract_text() or "")
        return "\n".join(pages)


    if ext == ".docx":
        docx_file = DocxDocument(str(path))
        parts = []


        # paragraphs first
        for para in docx_file.paragraphs:
            text = normalize_line(para.text)
            if text:
                parts.append(text)


        # tables after paragraphs
        for table in docx_file.tables:
            for row in table.rows:
                row_parts = []
                for cell in row.cells:
                    cell_text = normalize_line(cell.text)
                    if cell_text:
                        row_parts.append(cell_text)
                if row_parts:
                    parts.append(" | ".join(row_parts))


        return "\n".join(parts)


    return ""




def build_sop_chunks_from_lines(lines: List[str]) -> List[dict]:
    """
    Returns structured chunks with metadata:
    [
      {
        "title": "Procedure — Step 1",
        "section": "Procedure",
        "step_number": "1",
        "text": "..."
      }
    ]
    """
    chunks: List[dict] = []


    if not lines:
        return chunks


    metadata_lines = []
    body_start = 0


    # everything before first real heading goes to metadata
    for i, line in enumerate(lines):
        if is_section_heading(line) or is_step_heading(line):
            body_start = i
            break
        metadata_lines.append(line)
        body_start = i + 1


    if metadata_lines:
        chunks.append(
            {
                "title": "Metadata",
                "section": "Metadata",
                "step_number": None,
                "text": "\n".join(metadata_lines),
            }
        )


    current_section: Optional[str] = None
    current_step: Optional[str] = None
    current_lines: List[str] = []


    def flush_chunk():
        nonlocal current_section, current_step, current_lines


        if not current_lines and not current_section and not current_step:
            return


        title_parts = []
        if current_section:
            title_parts.append(current_section)
        if current_step:
            title_parts.append(current_step)


        title = " — ".join(title_parts).strip() or "Content"
        body = "\n".join(current_lines).strip()


        if body:
            chunks.append(
                {
                    "title": title,
                    "section": current_section,
                    "step_number": extract_step_number_from_heading(current_step) if current_step else None,
                    "text": body,
                }
            )


        current_step = None
        current_lines = []


    for line in lines[body_start:]:
        if is_step_heading(line):
            flush_chunk()
            current_step = normalize_line(line)
            current_lines = []
            continue


        if is_section_heading(line):
            flush_chunk()
            current_section = normalize_line(line)
            current_step = None
            current_lines = []
            continue


        current_lines.append(line)


    flush_chunk()
    return chunks




def structure_aware_chunk_text(text: str) -> List[dict]:
    lines = [normalize_line(line) for line in text.splitlines() if normalize_line(line)]
    structured_chunks = build_sop_chunks_from_lines(lines)


    # if not enough structure detected, fallback later
    return structured_chunks




def embed_text(text: str) -> List[float]:
    response = azure_client.embeddings.create(
        model=EMBEDDING_DEPLOYMENT,
        input=text,
    )
    return response.data[0].embedding




def rerank_sources(question: str, sources: List[dict], max_sources: int = 4) -> List[dict]:
    if not sources:
        return []


    numbered_sources = "\n\n".join(
        [
            (
                f"[{i+1}] Title: {s.get('title', '')}\n"
                f"Section: {s.get('section', '')}\n"
                f"Step: {s.get('stepNumber', '')}\n"
                f"Filename: {s['filename']}\n"
                f"Text: {s['text']}"
            )
            for i, s in enumerate(sources)
        ]
    )


    response = azure_client.chat.completions.create(
        model=CHAT_DEPLOYMENT,
        messages=[
            {
                "role": "system",
                "content": """
You are helping rank document chunks for a dental clinic AI assistant.


Given a user question and a list of retrieved document chunks, choose the most relevant chunks for answering the question.


Prioritize exact step matches when the user asks for a specific step number.


Return only a comma-separated list of chunk numbers in best-first order.
Example: 3,1,4,2


Do not explain your answer.
"""
            },
            {
                "role": "user",
                "content": f"""
Question:
{question}


Retrieved chunks:
{numbered_sources}


Return the top {max_sources} most relevant chunk numbers only.
"""
            }
        ],
        temperature=0,
    )


    content = (response.choices[0].message.content or "").strip()


    try:
        chosen_indexes = []
        for part in content.split(","):
            n = int(part.strip())
            if 1 <= n <= len(sources):
                chosen_indexes.append(n - 1)


        seen = set()
        unique_indexes = []
        for idx in chosen_indexes:
            if idx not in seen:
                seen.add(idx)
                unique_indexes.append(idx)


        reranked = [sources[idx] for idx in unique_indexes[:max_sources]]
        if reranked:
            return reranked
    except Exception:
        pass


    return sources[:max_sources]




def apply_question_heuristics(question: str, sources: List[dict]) -> List[dict]:
    if not sources:
        return sources


    q = question.lower()


    # exact step preference
    step_match = re.search(r"\bstep\s+(\d+)\b", q)
    if step_match:
        wanted = step_match.group(1)
        matching = [s for s in sources if str(s.get("stepNumber") or "") == wanted]
        non_matching = [s for s in sources if str(s.get("stepNumber") or "") != wanted]
        if matching:
            return matching + non_matching


    # notify / report preference
    notify_words = ["notify", "notification", "report", "reported", "manager", "principal dentist"]
    if any(word in q for word in notify_words):
        matching = [
            s for s in sources
            if any(word in (s.get("text", "") + " " + (s.get("title") or "")).lower() for word in notify_words)
        ]
        non_matching = [s for s in sources if s not in matching]
        if matching:
            return matching + non_matching


    return sources




# -------- Models --------
class IngestRequest(BaseModel):
    documentId: str




class AskRequest(BaseModel):
    organisationId: str
    clinicId: str | None = None
    roleAccess: str = "staff"
    question: str
    topK: int = 10




# -------- Routes --------
@app.get("/health")
def health():
    return {"status": "ok", "service": "dba-mvp-api"}




@app.post("/docs/upload")
async def upload_doc(
    file: UploadFile = File(...),
    organisationId: str = "",
    clinicId: str = "",
    documentType: str = "sop",
    roleAccess: str = "staff",
    sourceType: str = "internal",
    sourceUrl: str = "",
    isShared: bool = False,
    uploadedBy: str = "local-user",
    db: Session = Depends(get_db),
):
    if not organisationId:
        organisationId = "aa0938dd-55ff-4169-8aa2-6d59e9e0a5c4"


    if not clinicId and not isShared:
        clinicId = "52e46361-3012-491c-a2ab-c2b898352975"


    document_id = str(uuid.uuid4())


    tenant_path = UPLOAD_ROOT / organisationId / (clinicId if clinicId else "shared")
    tenant_path.mkdir(parents=True, exist_ok=True)


    save_path = tenant_path / file.filename


    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)


    doc = Document(
        documentId=document_id,
        organisationId=organisationId,
        clinicId=None if isShared else clinicId,
        filename=file.filename,
        documentType=documentType,
        roleAccess=roleAccess,
        sourceType=sourceType,
        sourceUrl=sourceUrl if sourceUrl else None,
        isShared=isShared,
        isCurrentVerified=True,
        uploadedBy=uploadedBy,
        status="active",
    )


    db.add(doc)
    db.commit()


    return {
        "status": "uploaded",
        "documentId": document_id,
        "organisationId": organisationId,
        "clinicId": clinicId,
        "filename": file.filename,
        "path": str(save_path),
        "sizeBytes": len(contents),
    }




@app.get("/docs/list")
def list_docs(organisationId: str, clinicId: str = None, db: Session = Depends(get_db)):
    query = db.query(Document).filter(
        Document.organisationId == organisationId,
        Document.status == "active",
    )


    if clinicId:
        query = query.filter(
            (Document.clinicId == clinicId) | (Document.isShared == True)
        )
    else:
        query = query.filter(Document.isShared == True)


    docs = query.all()


    return {
        "documents": [
            {
                "documentId": d.documentId,
                "filename": d.filename,
                "documentType": d.documentType,
                "roleAccess": d.roleAccess,
                "sourceType": d.sourceType,
                "isShared": d.isShared,
                "uploadedAt": d.uploadedAt,
            }
            for d in docs
        ]
    }




@app.post("/docs/ingest")
def ingest_doc(req: IngestRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.documentId == req.documentId).first()


    if not document:
        return {"status": "error", "message": "Document not found in database"}


    clinic_folder = document.clinicId if document.clinicId else "shared"
    doc_path = UPLOAD_ROOT / document.organisationId / clinic_folder / document.filename


    if not doc_path.exists():
        return {
            "status": "error",
            "message": "File not found on disk",
            "path": str(doc_path),
        }


    text = extract_text_from_file(doc_path)
    if not text.strip():
        return {
            "status": "error",
            "message": "No extractable text (try .txt or text-based PDF)",
        }


    structured_chunks = structure_aware_chunk_text(text)


    points = []


    if len(structured_chunks) >= 2:
        for idx, chunk in enumerate(structured_chunks):
            title = chunk.get("title") or "Content"
            section = chunk.get("section") or ""
            step_number = chunk.get("step_number")
            body_text = chunk.get("text") or ""


            enriched_text = f"""
Document: {document.filename}
Document Type: {document.documentType}
Chunk Title: {title}
Section: {section}
Step Number: {step_number if step_number else ""}


{body_text}
"""


            vec = embed_text(enriched_text)
            point_id = str(uuid.uuid4())


            payload = {
                "documentId": document.documentId,
                "organisationId": document.organisationId,
                "clinicId": document.clinicId,
                "filename": document.filename,
                "documentType": document.documentType,
                "roleAccess": document.roleAccess,
                "sourceType": document.sourceType,
                "isShared": document.isShared,
                "chunkIndex": idx,
                "sourceId": f"{document.documentId}:{idx}",
                "title": title,
                "section": section,
                "stepNumber": step_number,
                "text": body_text,
            }


            points.append(qm.PointStruct(id=point_id, vector=vec, payload=payload))
    else:
        fallback_chunks = fallback_chunk_text(text)
        for idx, chunk in enumerate(fallback_chunks):
            enriched_text = f"""
Document: {document.filename}
Document Type: {document.documentType}


{chunk}
"""
            vec = embed_text(enriched_text)
            point_id = str(uuid.uuid4())


            payload = {
                "documentId": document.documentId,
                "organisationId": document.organisationId,
                "clinicId": document.clinicId,
                "filename": document.filename,
                "documentType": document.documentType,
                "roleAccess": document.roleAccess,
                "sourceType": document.sourceType,
                "isShared": document.isShared,
                "chunkIndex": idx,
                "sourceId": f"{document.documentId}:{idx}",
                "title": None,
                "section": None,
                "stepNumber": None,
                "text": chunk,
            }


            points.append(qm.PointStruct(id=point_id, vector=vec, payload=payload))


    qdrant.upsert(collection_name=COLLECTION, points=points)


    return {
        "status": "ingested",
        "documentId": document.documentId,
        "organisationId": document.organisationId,
        "clinicId": document.clinicId,
        "filename": document.filename,
        "chunks": len(points),
        "collection": COLLECTION,
    }




@app.post("/ask")
def ask(req: AskRequest):
    qvec = embed_text(req.question)


    filters = [
        qm.FieldCondition(
            key="organisationId",
            match=qm.MatchValue(value=req.organisationId),
        ),
        qm.FieldCondition(
            key="roleAccess",
            match=qm.MatchValue(value=req.roleAccess),
        ),
    ]


    if req.clinicId:
        query_filter = qm.Filter(
            must=filters,
            should=[
                qm.FieldCondition(
                    key="clinicId",
                    match=qm.MatchValue(value=req.clinicId),
                ),
                qm.FieldCondition(
                    key="isShared",
                    match=qm.MatchValue(value=True),
                ),
            ],
        )
    else:
        query_filter = qm.Filter(
            must=filters + [
                qm.FieldCondition(
                    key="isShared",
                    match=qm.MatchValue(value=True),
                )
            ]
        )


    response = qdrant.query_points(
        collection_name=COLLECTION,
        query=qvec,
        limit=req.topK,
        query_filter=query_filter,
    )


    sources = []
    for point in response.points:
        payload = point.payload or {}
        sources.append(
            {
                "documentId": payload.get("documentId"),
                "filename": payload.get("filename"),
                "documentType": payload.get("documentType"),
                "roleAccess": payload.get("roleAccess"),
                "sourceType": payload.get("sourceType"),
                "chunkIndex": payload.get("chunkIndex"),
                "title": payload.get("title"),
                "section": payload.get("section"),
                "stepNumber": payload.get("stepNumber"),
                "score": point.score,
                "text": payload.get("text"),
            }
        )


    sources = sorted(sources, key=lambda x: x["score"], reverse=True)
    sources = apply_question_heuristics(req.question, sources)
    reranked_sources = rerank_sources(req.question, sources, max_sources=4)


    context = "\n\n".join(
        [
            (
                f"Document: {s['filename']}\n"
                f"Title: {s.get('title') or ''}\n"
                f"Section: {s.get('section') or ''}\n"
                f"Step Number: {s.get('stepNumber') or ''}\n"
                f"{s['text']}"
            )
            for s in reranked_sources
        ]
    )


    response = azure_client.chat.completions.create(
        model=CHAT_DEPLOYMENT,
        messages=[
            {
                "role": "system",
                "content": """
You are Dental Buddy AI assisting dental clinics with clinical procedures, protocols, and policies.


When answering:
- Always use clear formatting.
- Use markdown headings (###) for section titles.
- Use numbered lists for procedures or steps.
- Use bullet points for people, roles, or options.
- Add a blank line between sections.
- Keep sentences short and practical.
- Do NOT return long paragraphs.
- Do NOT include unnecessary explanations.
- Only include sections that are directly relevant to the user's question.
- Do NOT add extra sections unless the document content and the question require them.


If the user asks for a specific step:
- Return only that step.
- Do not include unrelated steps.


If the user asks about people, roles, or notifications:
- Return only the relevant people, roles, or notifications.


Always prioritize information from the provided clinic documents.


If the answer is not found, say that clearly.
If the documents only partially contain the answer, provide the best helpful explanation using the available context.
If the documents truly do not contain the answer, clearly state that.
"""
            },
            {
                "role": "user",
                "content": f"""
Use the following clinic documents to answer the question.


Documents:
{context}


Question:
{req.question}
"""
            }
        ],
        temperature=0.2,
    )


    answer = response.choices[0].message.content


    return {
        "organisationId": req.organisationId,
        "clinicId": req.clinicId,
        "question": req.question,
        "answer": answer,
        "sources": reranked_sources,
    }
