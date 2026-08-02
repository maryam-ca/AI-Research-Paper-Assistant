# Research Paper Assistant

AI-powered tool for analyzing, summarizing, and querying research papers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                                                                 │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│   │ Library  │   │  Detail  │   │   Q&A    │   │ Compare  │   │
│   │  Page    │   │  Tabs    │   │  Chat    │   │  Modal   │   │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   │
│        └───────────────┴──────────────┴───────────────┘         │
│                            │                                    │
│                     api/client.js                               │
│                  (fetch + timeout + errors)                     │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP (localhost:5173 → 8000)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    Rate Limiter                           │  │
│   │               (10 papers/IP/hour)                         │  │
│   └──────────────────────────┬───────────────────────────────┘  │
│                              │                                   │
│   ┌──────────────────────────▼───────────────────────────────┐  │
│   │                   API Routes                             │  │
│   │   /upload  /fetch  /ask  /compare  /citation  /cleanup  │  │
│   └──────┬──────────┬──────────┬──────────┬─────────────────┘  │
│          │          │          │          │                      │
│          ▼          ▼          ▼          ▼                      │
│   ┌──────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐            │
│   │ Ingestion│ │ Vector  │ │  LLM   │ │Attribution│           │
│   │ (pypdf)  │ │ Store   │ │ Client │ │  Check    │           │
│   │          │ │(Chroma) │ │(Gemini)│ │           │            │
│   └──────────┘ └─────────┘ └────────┘ └──────────┘            │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              LangGraph Pipeline                          │  │
│   │  extract → chunk → summarize → extract_elements → check  │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables

```bash
cp .env.example .env
# Edit .env and set your Gemini API key:
# GEMINI_API_KEY=your_key_here
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:5173

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/papers/upload` | Upload PDF, runs full pipeline |
| `POST` | `/api/papers/fetch?arxiv_id=...` | Fetch metadata from arXiv/DOI |
| `GET` | `/api/papers` | List all papers |
| `GET` | `/api/papers/{id}` | Get paper details |
| `POST` | `/api/papers/{id}/ask` | Ask a question about the paper |
| `POST` | `/api/papers/compare` | Compare multiple papers |
| `GET` | `/api/papers/{id}/citation?style=apa` | Generate citation (apa/mla/bibtex) |
| `POST` | `/api/papers/cleanup` | Manually purge papers older than 30 days |

## Features

- **PDF Processing** — Extract text, chunk, embed via Gemini, store in Chroma
- **Summarization** — Executive summary, detailed summary, key findings via Gemini
- **Key Element Extraction** — Problem statement, methodology, results, etc. as structured JSON
- **Source Attribution Check** — Flags summary sentences with no matching chunk (hallucination detection)
- **Q&A Chat** — Grounded answers with inline page citations
- **Paper Comparison** — Structured comparison of methodologies/findings across papers
- **Citations** — APA, MLA, BibTeX formatting
- **Rate Limiting** — 10 papers per IP per hour
- **Auto-Cleanup** — Papers and vector chunks deleted after 30 days

## Known Limitations

- **In-memory paper library** — Paper metadata is stored in-memory; restarting the backend clears it. Chroma data persists to disk.
- **Single-user rate limiter** — Tracks by IP only; no authentication or per-user quotas.
- **Scanned PDFs** — Only works with text-based PDFs. Scanned/image-only PDFs will raise an error (no OCR).
- **Gemini rate limits** — Heavy usage may hit Gemini API quotas. Retries with exponential backoff handle transient 429s, but sustained limits require raising your quota.
- **Large papers** — Very large PDFs may hit the 60s frontend timeout or Gemini token limits. Chunking is capped at ~1000 chars per chunk.
- **No streaming** — Summaries and Q&A responses wait for full generation before displaying.
- **No authentication** — The API is open; any client can upload/ask/compare.
- **Citation metadata** — Citation endpoint requires metadata from arXiv/DOI fetch; uploaded-only papers have no metadata.
