# 🦷 Dental Buddy AI

Dental Buddy AI is an AI-powered assistant for dental clinics that helps staff quickly access SOPs, procedures, and clinic documents using natural language.

It uses a Retrieval-Augmented Generation (RAG) pipeline with Azure OpenAI and Qdrant to provide accurate, clinic-specific answers.

---

## 🚀 Features

- 📄 Upload clinic documents (PDF, DOCX)
- 🔍 Semantic search using vector embeddings
- 🤖 AI-powered answers using Azure OpenAI
- 🧠 Context-aware responses from clinic SOPs
- 🛑 No hallucination (strict document-based mode)
- 👨‍⚕️ Safe fallback: escalate to Practice Manager when no info found

---

## 🧱 Architecture


Frontend (React)
↓
Backend (FastAPI)
↓
Azure OpenAI (Chat + Embeddings)
↓
Qdrant (Vector DB)
↓
SQLite (Metadata storage)


---

## ⚙️ Tech Stack

### Backend
- FastAPI
- SQLAlchemy (SQLite)
- Qdrant (Vector Database)
- Azure OpenAI
- Python

### Frontend
- React
- Vite

### Infrastructure
- Docker (Qdrant)
- Azure OpenAI

---

## 🧪 Local Setup

### 1. Prerequisites

Install the following:

#### 🐍 Python (3.12+ recommended)
Download and install from:
https://www.python.org/downloads/

⚠️ IMPORTANT:  
Tick **"Add Python to PATH"** during installation

Verify:
```bash
python --version
🐳 Docker Desktop

Download:
https://www.docker.com/products/docker-desktop/

Install and open Docker Desktop

Ensure it is running

Verify:

docker --version
🟢 Node.js (for frontend)

Download:
https://nodejs.org/

Verify:

node --version
npm --version
2. Clone the Repository
git clone <your-repo-url>
cd dba
3. Backend Setup
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
4. Create Environment Variables

Create a file:

Backend/.env

Add:

AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-api-key>
AZURE_OPENAI_API_VERSION=2024-02-01

AZURE_OPENAI_CHAT_DEPLOYMENT=<chat-deployment-name>
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=<embedding-deployment-name>

QDRANT_HOST=localhost
QDRANT_PORT=6333
5. Start Qdrant (Vector Database)
docker compose up -d

Verify:

docker ps

Optional check:
http://localhost:6333

6. Run Backend
cd Backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload

API Docs:

http://127.0.0.1:8000/docs
7. Run Frontend
cd Frontend
npm install
npm run dev
🧠 How It Works (RAG Pipeline)

Upload document

Chunk document

Generate embeddings (Azure OpenAI)

Store vectors in Qdrant

User asks question

Embed question

Retrieve relevant chunks

Send context to AI

Return structured answer

🛡️ Safety Design

Dental Buddy AI is designed to be clinically safe:

❌ Does NOT hallucinate answers

✅ Only answers from clinic documents

⚠️ If no answer found:

Escalates to Practice Manager / Dentist

Example:

No clinic-specific guidance found.
Please contact your Practice Manager or Principal Dentist.
⚠️ Common Issues
❌ 404 Error (Azure OpenAI)

Cause:
Wrong API version

Fix:

AZURE_OPENAI_API_VERSION=2024-02-01
❌ Embeddings Not Working

Check:

Deployment name is correct (dba-embedding)

Deployment exists in Azure

Same resource as endpoint

❌ .env Not Loading

Ensure file is located at:

Backend/.env
❌ Docker Not Running
docker ps

If empty:

docker compose up -d
📈 Future Improvements

Structure-aware chunking

Retrieval scoring thresholds

Source citation in answers

Hybrid knowledge mode

Admin dashboard

Multi-clinic support

🧑‍💻 Author

Built by Jacob Kino

📄 License

Private / Internal (update as needed)


---
