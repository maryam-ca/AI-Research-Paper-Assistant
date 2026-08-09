# ScholarFlow — AI Research Paper Assistant

AI-powered tool for analyzing, summarizing, and querying research papers. Built with React 19, FastAPI, LangGraph, Gemini API, SQLite, and ChromaDB.

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set your Gemini API key
cp .env.example .env
# Edit .env and set: GEMINI_API_KEY=your_key_here

uvicorn app.main:app --reload --port 8001
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:5173

## Architecture

```
Frontend (React 19 + Vite + Tailwind CSS v4)
    ↕ HTTP
Backend (FastAPI + LangGraph + Gemini API)
    ↕
SQLite (papers, notes, collections, Q&A) + ChromaDB (vector embeddings)
```

## Features

### Paper Ingestion
- Upload PDF, DOCX, TXT, Markdown, RTF, LaTeX, HTML files
- Import from arXiv ID, DOI, or arbitrary URL
- 11 supported file formats
- LangGraph pipeline: extract → chunk → embed → summarize → extract elements → attribution check

### AI-Powered Analysis (Google Gemini)
- Executive summary, detailed summary, key findings
- Structured key elements (problem, methodology, results, contributions, limitations, future work)
- Source attribution checking (flags unsupported claims)
- ELI5 / "Explain Like I'm New" simplified summaries
- Summary regeneration with custom instructions and length control
- Translation to 14 languages
- AI-suggested tags
- Flashcard generation (10-15 Q&A cards with difficulty levels)
- Figures and tables extraction
- Readability scoring (Flesch-Kincaid grade, reading ease)

### Q&A System
- Single-paper RAG Q&A with page citations
- Multi-paper Q&A across your entire library
- Follow-up question suggestions
- Q&A history persistence

### Paper Comparison
- Full paper comparison (overview, methodologies, findings, strengths/weaknesses, gaps)
- Methodology-focused comparison
- Cross-paper theme detection
- Contradiction detection
- Research gap identification

### Citation Management
- APA, MLA, BibTeX citation generation
- Collection BibTeX export
- Bulk BibTeX export
- Printable citation lists
- Citation count lookup via Crossref

### Collections
- Create, rename, delete collections
- Add/remove papers from collections
- Custom cover colors (8 options)
- Category tagging
- Literature review generation
- Public shareable collection links

### Notes
- Create, edit, delete notes with optional page references
- Version history with revert capability
- Notes search

### Reading Progress
- Section-level progress tracking
- Reading status (To Read, Reading, Read, Archived)
- Recently viewed papers
- Reading reminders for papers not opened in 30+ days

### Organization
- Global search across papers, notes, and Q&A
- Saved search queries (persisted in localStorage)
- Tag management with bulk operations
- Favorites/stars
- Paper pinning
- Related papers (vector similarity)
- "What to read next" AI recommendations

### Data Management
- Full JSON backup export and import
- Per-paper Markdown export
- Source file download
- Shareable paper digests
- Bulk delete, bulk tag editing, bulk collection add

### UI Features
- Material Design 3 color system (light + dark mode)
- Grid/list view toggle for library
- Font size adjustment (12-22px)
- High-contrast accessibility mode
- Paper card thumbnails with gradient backgrounds
- Skeleton loading states
- Empty states on every list view
- Undo toast after delete (5s delay)
- Keyboard shortcuts (/ for search, U for upload, Esc to close)
- Animated page transitions and micro-interactions
- In-app notification center
- Global error boundary with friendly error page

### Settings
- Light/dark theme toggle
- Font size slider
- High-contrast mode
- Default citation style (APA/MLA/BibTeX)
- JSON data import
- Clear all data (with confirmation)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS v4, React Router 7 |
| Backend | Python 3.11, FastAPI, LangGraph |
| LLM | Google Gemini (gemini-2.5-flash with fallback chain) |
| Database | SQLite (WAL mode, thread-safe) |
| Vectors | ChromaDB (HNSW index, Gemini embeddings) |
| PDF | pdfjs-dist (frontend), pypdf (backend) |
| Icons | Material Symbols Outlined |

## API Endpoints

70+ endpoints covering paper CRUD, AI analysis, collections, notes, Q&A, search, comparisons, citations, notifications, and data management. Full API documentation available at `/docs` when the backend is running.

## Notes

- **Gemini API key required** — Set `GEMINI_API_KEY` in `backend/.env`. Get one at https://aistudio.google.com/apikey
- **SQLite persistence** — Paper data persists to `backend/papers.db`. Restarting the backend does not lose data.
- **Auto-cleanup** — Papers older than 30 days are purged on backend startup.
- **Rate limiting** — 10 papers/IP/hour on upload/fetch endpoints.
- **Scanned PDFs** — Only text-based PDFs are supported (no OCR).
