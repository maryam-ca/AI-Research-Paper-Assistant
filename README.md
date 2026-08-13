# ScholarFlow — AI Research Paper Analysis Agent

A full-stack web app to upload, fetch, summarize, and chat with research papers —
then organize, assess, and synthesize whole libraries of them.

Built with **React + Vite** (frontend), **FastAPI + Mangum** (serverless backend),
**Postgres** (storage; embeddings stored as JSON — no `pgvector` extension required),
**Google Gemini** (generation & embeddings), and **Vercel Blob** (file/thumbnail storage).
Deployed on Vercel.

---

## Feature roadmap — implementation status

All four tiers of the original roadmap have been worked through. Items needing external
infrastructure that isn't present (auth, email sending, Zotero OAuth, a native mobile
app) are flagged as **Partial / Deferred** below.

### Tier 1 — High impact, low effort ✅

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Advanced search & filtering | ✅ | Full-text + title/abstract/keyword search; filters for **status, complexity, bias, source, year**, plus topic (keyword) chips. Backend `GET /api/papers/search` supports `q, source, complexity, status, year`. Save/reuse "reading queries" and autocomplete are not built. |
| 1.2 | Reading status & progress | ✅ | `reading_status` (not_started → reading → reviewed → completed) with timestamps; status badge on cards; **progress bar on detail page**; "to read / in progress" filtering. Per-section progress not built. |
| 1.3 | Keyword & topic extraction | ✅ | Gemini extracts 5–10 keywords per paper; keyword chips on cards/detail; topic filter; top-topics in Analytics. Word-cloud / auto-clustering UI not built. |
| 1.4 | Readability & complexity | ✅ | `readability_score` (0–100) + `complexity_level` (easy/medium/hard) extracted and shown as badges; filterable. |
| 1.5 | Export collection as reading list | ✅ | `POST /api/collections/{id}/export` → Markdown (or BibTeX). Download button on each collection in the sidebar. |
| 1.6 | Follow-up question suggestions | ✅ | `POST /api/papers/{id}/suggest-questions`; Q&A panel shows clickable suggestion chips + a ✨ suggest button. |
| 1.7 | Notes & inline highlighting | ✅* | Notes + tags API and a **Highlights** section (text + page #) are implemented. Rich-text editor (Quill/Slate) and note versioning are **not** built — notes are plain text. |

### Tier 2 — High impact, medium effort ✅ (mostly)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | Literature review generator | ✅ | `POST /api/collections/{id}/generate-literature-review` (Introduction / Methodology / Findings / Gaps / Future Work). Modal with tone + length, Markdown download. |
| 2.2 | Related papers (similarity) | ✅ | `GET /api/papers/{id}/similar` ranks papers by embedding-centroid cosine similarity. Detail **Related** tab shows match %. Citation-graph network visualization (D3/Cytoscape) not built. |
| 2.3 | Collaborative collections | ⏸ **Deferred** | Requires an authentication system (none exists). Needs `collection_members`, `user_id` on data, sharing UI, real-time. |
| 2.4 | Quality & rigor assessment | ✅ | `rigor_score` (0–100) + `bias_risk` (low/med/high) extracted, badge + filter. |
| 2.5 | Zotero / Mendeley sync | ⏸ **Deferred** | Needs Zotero OAuth credentials + token storage + background sync job. |
| 2.6 | Weekly digest / newsletter | ✅* | `POST /api/digest` generates a Markdown digest (papers added, new topics, reminders) for daily/weekly/monthly. **Email sending not wired** (no mail service). |
| 2.7 | Comparison matrix | ✅ | `POST /api/papers/compare-matrix` extracts methodology fields; modal table (approach, sample size, duration, data source, control group, outcome measures) with CSV export. |

### Tier 3 — Medium impact, high effort ✅ (mostly)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3.1 | Research questions & hypotheses | ✅ | `research_questions` table + CRUD; modal per collection tracks `active/resolved/abandoned`. Paper-linking table is lightweight (`paper_ids` array). |
| 3.2 | Chrome extension & quick-add | ✅* | `POST /api/papers/quick-add` + a minimal MV3 extension in `extension/` (popup posts a URL). Right-click-to-add and bookmarklet are not built. CORS allows `chrome-extension://`. |
| 3.3 | Mobile app (iOS/Android) | ⏸ **Deferred** | Separate React Native project; out of scope for this web codebase. |
| 3.4 | Analytics dashboard | ✅ | `GET /api/analytics/dashboard` aggregates topics, distributions, monthly velocity, avg rigor/reproducibility. **Analytics** sidebar page with CSS charts (no external chart lib). |
| 3.5 | Bias & reproducibility checker | ✅ | Extraction also returns `reproducibility_score` (0–100) + `quality_flags`; shown as badges/flags on detail page. |
| 3.6 | Export to Notion / Obsidian | ✅ | `GET /papers/{id}/export?format=obsidian|notion` (Obsidian = wikilinked MD; Notion = DB-property JSON). Buttons in ExportOptions. Bidirectional sync not built. |
| 3.7 | Multilingual translate | ✅ | `POST /papers/{id}/translate` translates summary + findings via Gemini; **Translate** button on detail page with language picker (ES/FR/DE/ZH/JA/AR/HI/PT…). |

---

## UI / UX surfaces (all wired)

**Sidebar nav:** Library · Recent · Search · Activity · Analytics · (Collections list) · Settings · Key Shortcuts · Support · dark-mode toggle.

**Library page:** upload + fetch-by-ID (arXiv / DOI / Link) cards; toolbar with search, filters (status, complexity, bias, source, year, sort), grid/list toggle, compare, bulk-select + bulk-delete, Literature Review / Research Questions (when a collection is open), Methodology Matrix (when ≥2 selected).

**Paper detail page tabs:** Summary · Key Elements · Notes (notes + highlights) · Activity · Related. Header shows status selector, complexity/readability/rigor/reproducibility badges, quality flags, keyword chips, reading-progress bar, export (Markdown/Obsidian/Notion/APA/MLA/BibTeX), Translate, and Ask-a-question (Q&A with follow-up suggestions).

**Other pages:** Recent, Search, Activity (+ digest), Analytics, Settings, Key Shortcuts (with working `/`, `g l/r/a`, `d`, `?` shortcuts), Support.

---

## Local development

### 1. Backend (Python)
```bash
cd frontend/api
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
# set env vars (see frontend/.env.local): DATABASE_URL, GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN
uvicorn main:app --reload --port 8000
```
Database migrations are incremental and re-runnable:
```bash
python migrate_tier1.py   # reading status, keywords, readability, complexity, highlights
python migrate_tier2.py   # rigor_score, bias_risk
python migrate_tier3.py   # research_questions, reproducibility_score, quality_flags
```
Or run `db/schema.sql` once against a fresh database.

### 2. Frontend (Node)
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173  (VITE_API_URL -> http://localhost:8000/api)
```

### 3. Chrome extension (optional)
Load `extension/` via `chrome://extensions` → Developer mode → Load unpacked.
Set the API base in the popup (defaults to `http://localhost:8000/api`), paste a paper
link, and click **Add to Library**.

---

## Deploy to Vercel

1. Push repo to GitHub.
2. Import the repo in Vercel and set **root directory = `frontend/`**.
3. Add env vars: `DATABASE_URL`, `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `VITE_API_URL`.
4. Deploy. `frontend/vercel.json` routes `/api/*` to the Python function.

---

## Project layout

```
frontend/
  api/            FastAPI backend (serverless via Mangum)
    main.py       app + CORS (+ chrome-extension origin) + Mangum handler
    routes.py     all /api endpoints (papers, collections, search, synthesis, analytics…)
    pipeline.py   extract → chunk → embed → summarize → extract elements
    llm_client.py Gemini client + fallback chain
    vectorstore.py JSON embedding storage + cosine similarity + paper-to-paper similarity
    extractor.py  key elements + keywords/readability/complexity/rigor/bias/reproducibility
    synthesis.py  literature review, digest, comparison matrix, translate
    qa_agent.py   RAG Q&A + follow-up suggestions
    models.py     SQLAlchemy models (papers, summaries, key_elements, chunks, qa, collections,
                  notes, highlights, activity, research_questions)
    migrate_tier1|2|3.py  incremental, re-runnable migrations
  src/            React frontend (pages/, components/, store/, api/)
  db/schema.sql   full DDL
  vercel.json     build + rewrite + function config
extension/        Chrome MV3 quick-add extension (popup, content, background scripts)
```
