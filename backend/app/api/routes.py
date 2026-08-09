import uuid
import tempfile
import os
import time
import json
import asyncio
import urllib.request
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import PlainTextResponse, FileResponse
from pydantic import BaseModel

from ..ingestion.metadata_fetcher import fetch_arxiv_metadata, fetch_doi_metadata
from ..processing.graph import build_graph
from ..processing.qa import answer_question
from ..processing.compare import compare_papers
from ..processing.citations import generate_citation
from ..storage import paper_store

router = APIRouter(prefix="/api/papers", tags=["papers"])

_graph = None
UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


def _get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def _run_pipeline(file_path: str, paper_id: str) -> dict:
    graph = _get_graph()
    initial = {
        "file_path": file_path,
        "paper_id": paper_id,
        "pages": None,
        "chunks": None,
        "full_text": "",
        "executive_summary": None,
        "detailed_summary": None,
        "key_findings": None,
        "key_elements": None,
        "attribution_report": None,
        "created_at": time.time(),
        "stage": "",
        "error": None,
    }
    result = graph.invoke(initial)
    if result["stage"].endswith(":failed"):
        raise HTTPException(status_code=422, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class QuestionRequest(BaseModel):
    question: str
    history: list[dict] | None = None


class CompareRequest(BaseModel):
    paper_ids: list[str]


class CollectionCreateRequest(BaseModel):
    name: str
    description: str = ""
    category: str = ""


class CollectionRenameRequest(BaseModel):
    name: str


class PaperIdRequest(BaseModel):
    paper_id: str


class PaperIdsRequest(BaseModel):
    paper_ids: list[str]


class TagUpdateRequest(BaseModel):
    tags: list[str]


class NoteCreateRequest(BaseModel):
    text: str
    page_ref: int | None = None


class NoteUpdateRequest(BaseModel):
    text: str


class ReadingProgressRequest(BaseModel):
    section: str


class StatusUpdateRequest(BaseModel):
    status: str


class BulkAddCollectionRequest(BaseModel):
    paper_ids: list[str]
    collection_id: str


class FetchUrlRequest(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Paper CRUD
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown", ".docx", ".doc", ".rtf", ".tex", ".latex", ".html", ".htm"}


@router.post("/upload")
async def upload_paper(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{suffix or '(none)'}' not supported. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    paper_id = uuid.uuid4().hex[:12]

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    # Save a copy for PDF viewer
    saved_path = UPLOADS_DIR / f"{paper_id}{suffix}"
    try:
        with open(saved_path, "wb") as f:
            f.write(content)
    except Exception:
        saved_path = None

    try:
        result = await asyncio.to_thread(_run_pipeline, tmp_path, paper_id)
    finally:
        os.unlink(tmp_path)

    paper = {
        "id": paper_id,
        "filename": file.filename,
        "metadata": None,
        "executive_summary": result["executive_summary"],
        "detailed_summary": result["detailed_summary"],
        "key_findings": result["key_findings"],
        "key_elements": result["key_elements"],
        "attribution_report": result["attribution_report"],
        "created_at": result["created_at"],
        "source_file": str(saved_path) if saved_path else None,
    }
    paper_store.save_paper(paper)

    paper_store.log_activity("upload", file.filename or "Untitled", paper_id)

    return {
        "paper_id": paper_id,
        "executive_summary": result["executive_summary"],
        "detailed_summary": result["detailed_summary"],
        "attribution_report": result["attribution_report"],
    }


@router.post("/fetch")
async def fetch_paper(arxiv_id: str | None = None, doi: str | None = None):
    if not arxiv_id and not doi:
        raise HTTPException(status_code=400, detail="Provide arxiv_id or doi")

    if arxiv_id:
        metadata = fetch_arxiv_metadata(arxiv_id)
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"
    else:
        metadata = fetch_doi_metadata(doi)
        pdf_url = None

    paper_id = uuid.uuid4().hex[:12]

    results = {
        "executive_summary": None,
        "detailed_summary": None,
        "key_findings": None,
        "key_elements": None,
        "attribution_report": None,
    }
    saved_path = None
    if pdf_url:
        tmp_path = None
        try:
            req = urllib.request.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp, tempfile.NamedTemporaryFile(
                delete=False, suffix=".pdf"
            ) as tmp:
                pdf_bytes = resp.read()
                tmp.write(pdf_bytes)
                tmp_path = tmp.name
            # Save copy for viewer
            saved_path = UPLOADS_DIR / f"{paper_id}.pdf"
            try:
                with open(saved_path, "wb") as f:
                    f.write(pdf_bytes)
            except Exception:
                saved_path = None
            try:
                result = await asyncio.to_thread(_run_pipeline, tmp_path, paper_id)
                results = {
                    "executive_summary": result["executive_summary"],
                    "detailed_summary": result["detailed_summary"],
                    "key_findings": result["key_findings"],
                    "key_elements": result["key_elements"],
                    "attribution_report": result["attribution_report"],
                }
                metadata["published_date"] = metadata.get("published_date") or (
                    f"{time.strftime('%Y-%m', time.localtime(result['created_at']))}-01"
                )
            except Exception:
                pass
        except Exception:
            pass
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    paper = {
        "id": paper_id,
        "filename": metadata["title"],
        "metadata": metadata,
        **results,
        "created_at": time.time(),
        "source_file": str(saved_path) if saved_path else None,
    }
    paper_store.save_paper(paper)

    paper_store.log_activity("fetch", metadata.get("title", "Untitled"), paper_id)

    return {
        "paper_id": paper_id,
        "metadata": metadata,
        **{k: v for k, v in results.items() if v is not None},
    }


@router.post("/fetch-url")
async def fetch_from_url(body: FetchUrlRequest):
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    paper_id = uuid.uuid4().hex[:12]
    suffix = ".pdf"
    if ".txt" in url: suffix = ".txt"
    elif ".md" in url: suffix = ".md"
    elif ".docx" in url: suffix = ".docx"

    tmp_path = None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            content = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if "pdf" in ct: suffix = ".pdf"
            elif "html" in ct: suffix = ".html"
            elif "text" in ct: suffix = ".txt"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        saved_path = UPLOADS_DIR / f"{paper_id}{suffix}"
        try:
            with open(saved_path, "wb") as f:
                f.write(content)
        except Exception:
            saved_path = None

        result = await asyncio.to_thread(_run_pipeline, tmp_path, paper_id)

        filename = url.split("/")[-1].split("?")[0] or f"paper_{paper_id}"
        if not any(filename.endswith(e) for e in ALLOWED_EXTENSIONS):
            filename += suffix

        paper = {
            "id": paper_id,
            "filename": filename,
            "metadata": {"source": url, "title": filename},
            "executive_summary": result["executive_summary"],
            "detailed_summary": result["detailed_summary"],
            "key_findings": result["key_findings"],
            "key_elements": result["key_elements"],
            "attribution_report": result["attribution_report"],
            "created_at": result["created_at"],
            "source_file": str(saved_path) if saved_path else None,
        }
        paper_store.save_paper(paper)

        return {
            "paper_id": paper_id,
            "executive_summary": result["executive_summary"],
            "detailed_summary": result["detailed_summary"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to fetch from URL: {e}")
    finally:
        if tmp_path:
            try: os.unlink(tmp_path)
            except OSError: pass


@router.get("/{paper_id}/file")
async def serve_paper_file(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    src = paper.get("source_file")
    if not src or not os.path.exists(src):
        raise HTTPException(status_code=404, detail="Source file not available")
    return FileResponse(src, media_type="application/octet-stream",
                         filename=paper.get("filename", "document"))


@router.get("")
def list_papers():
    return paper_store.list_papers()


@router.get("/search")
def search_papers(q: str = Query("")):
    if not q.strip():
        return paper_store.list_papers()
    return paper_store.search_papers(q)


@router.get("/global-search")
def global_search(q: str = Query("")):
    if not q.strip():
        return {"papers": [], "notes": [], "qa": []}
    papers = paper_store.search_papers(q)
    notes = paper_store.search_notes(q)
    qa = paper_store.search_qa(q)
    return {"papers": papers, "notes": notes, "qa": qa}


@router.get("/activities")
def get_activities(limit: int = Query(50)):
    return paper_store.list_activities(limit)


@router.get("/recent")
def list_recent():
    return paper_store.list_papers_recent()


@router.get("/stats")
def get_stats():
    papers = paper_store.list_papers()
    collections = paper_store.list_collections()
    all_tags = {}
    this_week = time.time() - 7 * 86400
    week_count = 0
    for p in papers:
        meta = p.get("metadata") or {}
        for tag in meta.get("tags", []):
            all_tags[tag] = all_tags.get(tag, 0) + 1
        if p.get("created_at", 0) > this_week:
            week_count += 1
    top_tags = sorted(all_tags.items(), key=lambda x: -x[1])[:10]
    return {
        "total_papers": len(papers),
        "total_collections": len(collections),
        "top_tags": [{"tag": t, "count": c} for t, c in top_tags],
        "papers_this_week": week_count,
    }


@router.post("/compare")
def compare(body: CompareRequest):
    if len(body.paper_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two paper IDs required")
    missing = [pid for pid in body.paper_ids if not paper_store.get_paper(pid)]
    if missing:
        raise HTTPException(status_code=404, detail=f"Papers not found: {missing}")
    paper_store.log_activity("compare", f"Compared {len(body.paper_ids)} papers")
    return compare_papers(body.paper_ids)


@router.post("/cleanup")
def cleanup_expired():
    from ..storage.vector_store import purge_expired as purge_vectors
    expired_ids = paper_store.purge_expired(max_age_days=30)
    deleted_vectors = 0
    for pid in expired_ids:
        deleted_vectors += purge_vectors(max_age_days=30)
    return {"deleted_papers": len(expired_ids), "deleted_chunks": deleted_vectors}


# ---------------------------------------------------------------------------
# Bulk Operations
# ---------------------------------------------------------------------------

@router.post("/bulk-delete")
def bulk_delete(body: PaperIdsRequest):
    count = paper_store.bulk_delete_papers(body.paper_ids)
    paper_store.log_activity("bulk_delete", f"Deleted {count} papers")
    return {"deleted": count}


@router.post("/bulk-add-collection")
def bulk_add_to_collection(body: BulkAddCollectionRequest):
    for pid in body.paper_ids:
        paper_store.add_paper_to_collection(body.collection_id, pid)
    return {"ok": True, "added": len(body.paper_ids)}


@router.post("/bulk-export-bibtex")
def bulk_export_bibtex(body: PaperIdsRequest):
    items = paper_store.bulk_export_bibtex(body.paper_ids)
    entries = []
    for item in items:
        meta = item.get("metadata")
        if meta:
            try:
                entries.append(generate_citation(meta, "bibtex"))
            except Exception:
                pass
    content = "\n\n".join(entries)
    return PlainTextResponse(content, media_type="text/plain",
                             headers={"Content-Disposition": "attachment; filename=papers.bib"})


@router.get("/export-all")
def export_all_data():
    data = paper_store.export_all_data()
    import json as _json
    content = _json.dumps(data, indent=2, default=str)
    return PlainTextResponse(content, media_type="application/json",
                             headers={"Content-Disposition": "attachment; filename=scholarflow_backup.json"})


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

@router.get("/collections/all")
def list_collections():
    return paper_store.list_collections()


@router.post("/collections/create")
def create_collection(body: CollectionCreateRequest):
    return paper_store.create_collection(body.name, body.description, body.category)


@router.get("/collections/{collection_id}")
def get_collection(collection_id: str):
    c = paper_store.get_collection(collection_id)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    return c


@router.put("/collections/{collection_id}")
def rename_collection(collection_id: str, body: CollectionRenameRequest):
    if not paper_store.rename_collection(collection_id, body.name):
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"ok": True}


@router.delete("/collections/{collection_id}")
def delete_collection(collection_id: str):
    if not paper_store.delete_collection(collection_id):
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"ok": True}


@router.post("/collections/{collection_id}/add")
def add_to_collection(collection_id: str, body: PaperIdRequest):
    paper_store.add_paper_to_collection(collection_id, body.paper_id)
    c = paper_store.get_collection(collection_id)
    paper_store.log_activity("add_to_collection", f"Added to {c['name'] if c else collection_id}", body.paper_id)
    return {"ok": True}


@router.post("/collections/{collection_id}/remove")
def remove_from_collection(collection_id: str, body: PaperIdRequest):
    paper_store.remove_paper_from_collection(collection_id, body.paper_id)
    return {"ok": True}


@router.get("/collections/{collection_id}/export-bibtex")
def export_collection_bibtex(collection_id: str):
    c = paper_store.get_collection(collection_id)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    entries = []
    for p in c.get("papers", []):
        meta = p.get("metadata")
        if meta:
            try:
                entries.append(generate_citation(meta, "bibtex"))
            except Exception:
                pass
    content = "\n\n".join(entries)
    return PlainTextResponse(content, media_type="text/plain",
                             headers={"Content-Disposition": f"attachment; filename=collection_{collection_id}.bib"})


# ---------------------------------------------------------------------------
# Literature Review
# ---------------------------------------------------------------------------

class LitReviewRequest(BaseModel):
    collection_id: str


LIT_REVIEW_PROMPT = """\
You are a research assistant. Below are excerpts from {n} papers in a \
collection. Generate a structured literature review with these sections:

1. **Introduction** - Brief overview of the collection's theme
2. **Thematic Synthesis** - Group papers by common themes, compare findings
3. **Methodologies** - Overview of methods used across papers
4. **Research Gaps** - Identify gaps and unaddressed areas
5. **Conclusion** - Summary and future directions

Be thorough but concise. Reference papers by their titles.

{papers_text}
"""


@router.post("/literature-review")
def generate_lit_review(body: LitReviewRequest):
    c = paper_store.get_collection(body.collection_id)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    papers = c.get("papers", [])
    if len(papers) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 papers for a literature review")

    from ..storage.vector_store import similarity_search
    from ..llm_client import gemini_generate

    papers_text = ""
    for p in papers:
        pid = p["id"]
        title = p.get("filename", pid)
        matches = similarity_search("methodology results findings", paper_id=pid, top_k=8)
        excerpts = "\n".join(f"[page {m['page']}] {m['text']}" for m in matches)
        papers_text += f"=== {title} (ID: {pid}) ===\n{excerpts}\n\n"

    review = gemini_generate(
        LIT_REVIEW_PROMPT.format(n=len(papers), papers_text=papers_text)
    )
    return {"review": review, "paper_count": len(papers), "collection_name": c["name"]}


# ---------------------------------------------------------------------------
# Related Papers
# ---------------------------------------------------------------------------

@router.get("/{paper_id}/related")
def get_related_papers(paper_id: str, limit: int = Query(5)):
    from ..storage.vector_store import similarity_search
    all_ids = paper_store.list_all_paper_ids()
    other_ids = [pid for pid in all_ids if pid != paper_id]
    if not other_ids:
        return {"related": []}

    try:
        matches = similarity_search("methodology results findings contributions", paper_id=paper_id, top_k=20)
    except Exception:
        matches = []
    scored = {}
    for m in matches:
        pid = m["paper_id"]
        if pid != paper_id and pid in other_ids:
            scored[pid] = scored.get(pid, 0) + m["score"]

    sorted_papers = sorted(scored.items(), key=lambda x: -x[1])[:limit]
    result = []
    for pid, score in sorted_papers:
        p = paper_store.get_paper(pid)
        if p:
            result.append({"id": pid, "filename": p.get("filename"), "metadata": p.get("metadata"),
                           "executive_summary": (p.get("executive_summary") or "")[:200], "score": round(score, 3)})
    return {"related": result}


# ---------------------------------------------------------------------------
# Reading Progress
# ---------------------------------------------------------------------------

@router.post("/{paper_id}/progress")
def update_progress(paper_id: str, body: ReadingProgressRequest):
    paper_store.update_reading_progress(paper_id, body.section)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

@router.get("/{paper_id}/notes")
def list_notes(paper_id: str):
    return paper_store.list_notes(paper_id)


@router.post("/{paper_id}/notes")
def create_note(paper_id: str, body: NoteCreateRequest):
    return paper_store.add_note(paper_id, body.text, body.page_ref)


@router.put("/notes/{note_id}")
def edit_note(note_id: str, body: NoteUpdateRequest):
    if not paper_store.update_note(note_id, body.text):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


@router.delete("/notes/{note_id}")
def remove_note(note_id: str):
    if not paper_store.delete_note(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


class NoteRevertRequest(BaseModel):
    version_id: str


@router.get("/notes/{note_id}/versions")
def get_note_versions(note_id: str):
    return paper_store.get_note_versions(note_id)


@router.post("/notes/{note_id}/revert")
def revert_note_to_version(note_id: str, body: NoteRevertRequest):
    if not paper_store.revert_note(note_id, body.version_id):
        raise HTTPException(status_code=404, detail="Version or note not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@router.put("/{paper_id}/tags")
def update_tags(paper_id: str, body: TagUpdateRequest):
    paper_store.update_paper_tags(paper_id, body.tags)
    return {"ok": True}


@router.put("/{paper_id}/status")
def update_status(paper_id: str, body: StatusUpdateRequest):
    valid_statuses = ["to_read", "reading", "read", "archived"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper["status"] = body.status
    paper_store.save_paper(paper)
    return {"ok": True, "status": body.status}


# ---------------------------------------------------------------------------
# Q&A History
# ---------------------------------------------------------------------------

@router.get("/{paper_id}/qa-history")
def get_qa_history(paper_id: str):
    return paper_store.list_qa_history(paper_id)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@router.get("/{paper_id}/export-markdown")
def export_paper_markdown(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    md = _paper_to_markdown(paper)
    return PlainTextResponse(md, media_type="text/markdown",
                             headers={"Content-Disposition": f"attachment; filename={paper_id}.md"})


@router.get("/{paper_id}/citation")
def citation(paper_id: str, style: str = Query("apa")):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper.get("metadata"):
        raise HTTPException(status_code=400, detail="No metadata available for this paper")
    try:
        return {"citation": generate_citation(paper["metadata"], style)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Summary Regeneration
# ---------------------------------------------------------------------------

class RegenerateRequest(BaseModel):
    section: str
    instruction: str = ""
    length: str = "medium"


@router.post("/{paper_id}/regenerate")
def regenerate_summary(paper_id: str, body: RegenerateRequest):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if body.section not in ("executive", "detailed", "findings"):
        raise HTTPException(status_code=400, detail="section must be one of: executive, detailed, findings")
    if body.length not in ("short", "medium", "long"):
        raise HTTPException(status_code=400, detail="length must be one of: short, medium, long")

    from ..processing.summarizer import regenerate_section
    from ..storage.vector_store import similarity_search

    matches = similarity_search("full text content", paper_id=paper_id, top_k=30)
    if matches:
        full_text = "\n\n".join(m["text"] for m in matches)
    else:
        full_text = paper.get("executive_summary", "") + "\n\n" + (paper.get("detailed_summary", "") or "")

    try:
        new_text = regenerate_section(full_text, body.section, body.instruction, body.length)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {e}")

    col_map = {
        "executive": "executive_summary",
        "detailed": "detailed_summary",
        "findings": "key_findings",
    }
    paper[col_map[body.section]] = new_text
    paper_store.save_paper(paper)

    return {"section": body.section, "text": new_text}


# ---------------------------------------------------------------------------
# Flashcards
# ---------------------------------------------------------------------------

class FlashcardRequest(BaseModel):
    pass


@router.post("/{paper_id}/flashcards")
def generate_flashcards_route(paper_id: str, body: FlashcardRequest):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    from ..processing.qa import generate_flashcards
    flashcards = generate_flashcards(paper_id, paper.get("key_findings", ""))
    return {"flashcards": flashcards}


# ---------------------------------------------------------------------------
# Summary Translation
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    section: str
    target_language: str


@router.post("/{paper_id}/translate")
def translate_summary(paper_id: str, body: TranslateRequest):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    valid_sections = ("executive", "detailed", "findings")
    if body.section not in valid_sections:
        raise HTTPException(status_code=400, detail=f"section must be one of: {valid_sections}")

    col_map = {
        "executive": "executive_summary",
        "detailed": "detailed_summary",
        "findings": "key_findings",
    }
    summary = paper.get(col_map[body.section])
    if not summary:
        raise HTTPException(status_code=400, detail=f"No {body.section} summary available to translate")

    if not isinstance(summary, str):
        summary = json.dumps(summary, ensure_ascii=False)

    from ..processing.summarizer import translate_summary as _translate
    try:
        translated = _translate(summary, body.target_language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {e}")

    if paper.get("metadata") is None:
        paper["metadata"] = {}
    if "translations" not in paper["metadata"]:
        paper["metadata"]["translations"] = {}
    paper["metadata"]["translations"][body.section] = paper["metadata"]["translations"].get(body.section, {})
    paper["metadata"]["translations"][body.section][body.target_language] = translated
    paper_store.save_paper(paper)

    return {"translated_summary": translated, "language": body.target_language, "section": body.section}


# ---------------------------------------------------------------------------
# Tag Suggestions
# ---------------------------------------------------------------------------

class SuggestTagsRequest(BaseModel):
    pass


@router.post("/{paper_id}/suggest-tags")
def suggest_tags(paper_id: str, body: SuggestTagsRequest):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    from ..processing.summarizer import suggest_tags
    from ..storage.vector_store import similarity_search

    matches = similarity_search("full text content", paper_id=paper_id, top_k=30)
    if matches:
        full_text = "\n\n".join(m["text"] for m in matches)
    else:
        full_text = paper.get("executive_summary", "") + "\n\n" + (paper.get("detailed_summary", "") or "") + "\n\n" + (paper.get("key_findings", "") or "")

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No content available for tag suggestion")

    try:
        tags = suggest_tags(full_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tag suggestion failed: {e}")

    return {"suggested_tags": tags}


# ---------------------------------------------------------------------------
# Multi-Paper Q&A
# ---------------------------------------------------------------------------

class MultiQARequest(BaseModel):
    paper_ids: list[str]
    question: str
    history: list[dict] | None = None


@router.post("/multi-qa")
def multi_paper_qa(body: MultiQARequest):
    if not body.paper_ids:
        raise HTTPException(status_code=400, detail="At least one paper ID required")
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    missing = [pid for pid in body.paper_ids if not paper_store.get_paper(pid)]
    if missing:
        raise HTTPException(status_code=404, detail=f"Papers not found: {missing}")

    from ..processing.qa import answer_question_multi
    result = answer_question_multi(body.paper_ids, body.question, body.history)
    return result


# ---------------------------------------------------------------------------
# Methodology Comparison
# ---------------------------------------------------------------------------

class MethodologyCompareRequest(BaseModel):
    paper_ids: list[str]


@router.post("/methodology-compare")
def methodology_compare(body: MethodologyCompareRequest):
    if len(body.paper_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two paper IDs required")

    missing = [pid for pid in body.paper_ids if not paper_store.get_paper(pid)]
    if missing:
        raise HTTPException(status_code=404, detail=f"Papers not found: {missing}")

    from ..processing.compare import compare_methodologies
    result = compare_methodologies(body.paper_ids)
    return result


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationReadRequest(BaseModel):
    notification_id: str


@router.get("/notifications")
def get_notifications(limit: int = Query(50), unread_only: bool = Query(False)):
    return paper_store.list_notifications(limit, unread_only)


@router.post("/notifications/read")
def mark_notification_read(body: NotificationReadRequest):
    ok = paper_store.mark_notification_read(body.notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read():
    count = paper_store.mark_all_notifications_read()
    return {"ok": True, "count": count}


@router.get("/reading-reminders")
def get_reading_reminders(days: int = Query(30)):
    reminders = paper_store.get_reading_reminders(days)
    return {"reminders": reminders, "count": len(reminders), "days_threshold": days}


# ---------------------------------------------------------------------------
# Readability Score
# ---------------------------------------------------------------------------

@router.post("/{paper_id}/readability")
def compute_readability(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    from ..processing.summarizer import compute_readability_scores
    from ..storage.vector_store import similarity_search

    matches = similarity_search("full text content", paper_id=paper_id, top_k=30)
    if matches:
        full_text = "\n\n".join(m["text"] for m in matches)
    else:
        full_text = paper.get("executive_summary", "") + "\n\n" + (paper.get("detailed_summary", "") or "") + "\n\n" + (paper.get("key_findings", "") or "")

    scores = compute_readability_scores(full_text)

    if paper.get("metadata") is None:
        paper["metadata"] = {}
    paper["metadata"]["readability"] = scores
    paper_store.save_paper(paper)

    return {"readability": scores}


# ---------------------------------------------------------------------------
# Simplified Summary (ELI5)
# ---------------------------------------------------------------------------

class SimplifiedSummaryRequest(BaseModel):
    instruction: str = ""


@router.post("/{paper_id}/simplified")
def generate_simplified_summary(paper_id: str, body: SimplifiedSummaryRequest):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    from ..processing.summarizer import generate_simplified_summary
    from ..storage.vector_store import similarity_search

    matches = similarity_search("full text content", paper_id=paper_id, top_k=30)
    if matches:
        full_text = "\n\n".join(m["text"] for m in matches)
    else:
        full_text = paper.get("executive_summary", "") + "\n\n" + (paper.get("detailed_summary", "") or "") + "\n\n" + (paper.get("key_findings", "") or "")

    try:
        simplified = generate_simplified_summary(full_text, body.instruction)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simplified summary generation failed: {e}")

    if paper.get("metadata") is None:
        paper["metadata"] = {}
    paper["metadata"]["simplified_summary"] = simplified
    paper_store.save_paper(paper)

    return {"simplified_summary": simplified}


# ---------------------------------------------------------------------------
# Figures/Tables
# ---------------------------------------------------------------------------

@router.post("/{paper_id}/figures-tables")
def extract_figures_tables(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    from ..processing.extractor import extract_figures_tables
    from ..storage.vector_store import similarity_search

    matches = similarity_search("figure table caption", paper_id=paper_id, top_k=30)
    if matches:
        full_text = "\n\n".join(m["text"] for m in matches)
    else:
        full_text = paper.get("executive_summary", "") + "\n\n" + (paper.get("detailed_summary", "") or "") + "\n\n" + (paper.get("key_findings", "") or "")

    result = extract_figures_tables(full_text)

    if paper.get("metadata") is None:
        paper["metadata"] = {}
    paper["metadata"]["figures_tables"] = result
    paper_store.save_paper(paper)

    return {"figures_tables": result}


@router.get("/{paper_id}/share-digest")
def share_digest(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    meta = paper.get("metadata") or {}
    return {
        "title": paper.get("filename", "Untitled"),
        "authors": meta.get("authors", []),
        "published_date": meta.get("published_date"),
        "abstract": meta.get("abstract"),
        "executive_summary": paper.get("executive_summary"),
        "key_findings": paper.get("key_findings"),
    }


# ---------------------------------------------------------------------------
# Paper detail (must be last — catches /{paper_id})
# ---------------------------------------------------------------------------

@router.get("/{paper_id}")
def get_paper(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper_store.touch_paper(paper_id)
    return paper


@router.post("/{paper_id}/ask")
def ask_question_route(paper_id: str, body: QuestionRequest):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    result = answer_question(paper_id, body.question, history=body.history)
    follow_ups = _generate_follow_ups(paper_id, body.question, result["answer"], paper, body.history)
    result["follow_ups"] = follow_ups
    paper_store.save_qa(paper_id, body.question, result["answer"], result.get("sources"), follow_ups)
    paper_store.log_activity("ask", body.question, paper_id)
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_follow_ups(paper_id: str, question: str, answer: str, paper: dict, history: list | None) -> list[str]:
    try:
        from ..llm_client import gemini_generate
        meta = paper.get("metadata") or {}
        title = paper.get("filename", "the paper")
        prompt = f"""Based on the paper "{title}", generate exactly 3 short follow-up questions \
that a researcher might ask next. The user just asked: "{question}" \
and received this answer: "{answer[:500]}".
Return ONLY a JSON array of 3 strings, no other text. Example:
["Question 1?", "Question 2?", "Question 3?"]"""
        raw = gemini_generate(prompt, generation_config={"response_mime_type": "application/json"})
        import json as _json
        items = _json.loads(raw)
        if isinstance(items, list):
            return [str(q) for q in items[:3]]
    except Exception:
        pass
    return []


# ---------------------------------------------------------------------------
# Paper detail helpers
# ---------------------------------------------------------------------------

def _paper_to_markdown(paper: dict) -> str:
    lines = []
    meta = paper.get("metadata") or {}
    lines.append(f"# {paper.get('filename', 'Untitled')}")
    lines.append("")
    if meta.get("authors"):
        lines.append(f"**Authors:** {', '.join(meta['authors'])}")
    if meta.get("published_date"):
        lines.append(f"**Published:** {meta['published_date']}")
    if meta.get("abstract"):
        lines.append(f"\n## Abstract\n\n{meta['abstract']}")
    if paper.get("executive_summary"):
        lines.append(f"\n## Executive Summary\n\n{paper['executive_summary']}")
    if paper.get("detailed_summary"):
        lines.append(f"\n## Detailed Summary\n\n{paper['detailed_summary']}")
    if paper.get("key_findings"):
        lines.append(f"\n## Key Findings\n\n{paper['key_findings']}")
    if paper.get("key_elements"):
        lines.append(f"\n## Key Elements\n\n")
        for k, v in paper["key_elements"].items():
            lines.append(f"### {k.replace('_', ' ').title()}\n")
            if isinstance(v, list):
                for item in v:
                    lines.append(f"- {item}")
            else:
                lines.append(str(v))
            lines.append("")
    notes = paper_store.list_notes(paper["id"])
    if notes:
        lines.append(f"\n## Notes\n\n")
        for n in notes:
            ref = f" (p. {n['page_ref']})" if n.get("page_ref") else ""
            lines.append(f"- {n['text']}{ref}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Feature: Favorites / Star papers
# ---------------------------------------------------------------------------

@router.post("/{paper_id}/favorite")
def toggle_favorite(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    meta = paper.get("metadata") or {}
    meta["is_favorite"] = not meta.get("is_favorite", False)
    paper_store.update_metadata(paper_id, meta)
    return {"is_favorite": meta["is_favorite"]}


@router.get("/favorites")
def list_favorites():
    papers = paper_store.list_papers()
    return [p for p in papers if (p.get("metadata") or {}).get("is_favorite")]


# ---------------------------------------------------------------------------
# Feature: Duplicate paper detection
# ---------------------------------------------------------------------------

@router.post("/check-duplicate")
def check_duplicate(body: dict):
    filename = body.get("filename", "")
    if not filename:
        return {"is_duplicate": False}
    papers = paper_store.list_papers()
    name_lower = filename.lower().replace(".pdf", "").replace(".docx", "").strip()
    for p in papers:
        existing_name = (p.get("filename") or "").lower().replace(".pdf", "").replace(".docx", "").strip()
        if existing_name == name_lower:
            return {"is_duplicate": True, "existing_paper_id": p["id"], "existing_name": p.get("filename")}
        ratio = len(set(name_lower.split()) & set(existing_name.split())) / max(len(set(name_lower.split())), 1)
        if ratio > 0.85 and len(name_lower) > 10:
            return {"is_duplicate": True, "existing_paper_id": p["id"], "existing_name": p.get("filename")}
    return {"is_duplicate": False}


# ---------------------------------------------------------------------------
# Feature: Bulk tag editor
# ---------------------------------------------------------------------------

class BulkTagRequest(BaseModel):
    paper_ids: list[str]
    tags_to_add: list[str] = []
    tags_to_remove: list[str] = []


@router.put("/bulk-tags")
def bulk_update_tags(body: BulkTagRequest):
    for pid in body.paper_ids:
        paper = paper_store.get_paper(pid)
        if not paper:
            continue
        meta = paper.get("metadata") or {}
        current_tags = list(meta.get("tags") or [])
        for t in body.tags_to_add:
            if t not in current_tags:
                current_tags.append(t)
        for t in body.tags_to_remove:
            current_tags = [x for x in current_tags if x != t]
        meta["tags"] = current_tags
        paper_store.update_metadata(pid, meta)
    return {"updated": len(body.paper_ids)}


# ---------------------------------------------------------------------------
# Feature: Collection share link
# ---------------------------------------------------------------------------

@router.get("/collections/{collection_id}/share")
def get_collection_share_data(collection_id: str):
    col = paper_store.get_collection(collection_id)
    if not col:
        raise HTTPException(404, "Collection not found")
    papers = []
    for pid in col.get("paper_ids", []):
        p = paper_store.get_paper(pid)
        if p:
            papers.append({
                "id": p["id"],
                "filename": p.get("filename"),
                "executive_summary": p.get("executive_summary"),
                "key_findings": p.get("key_findings"),
                "metadata": p.get("metadata"),
            })
    return {
        "collection": {
            "id": col["id"],
            "name": col["name"],
            "description": col.get("description"),
            "category": col.get("category"),
        },
        "papers": papers,
    }


# ---------------------------------------------------------------------------
# Feature: Printable citation list
# ---------------------------------------------------------------------------

class CitationPrintRequest(BaseModel):
    paper_ids: list[str]
    style: str = "apa"


@router.post("/citations-print")
def generate_printable_citations(body: CitationPrintRequest):
    citations = []
    for pid in body.paper_ids:
        paper = paper_store.get_paper(pid)
        if paper:
            try:
                c = generate_citation(paper, body.style)
                citations.append({"paper_id": pid, "filename": paper.get("filename"), "citation": c})
            except Exception:
                citations.append({"paper_id": pid, "filename": paper.get("filename"), "citation": "Citation unavailable"})
    return {"citations": citations, "style": body.style}


# ---------------------------------------------------------------------------
# Feature: Cross-paper theme detection
# ---------------------------------------------------------------------------

class ThemeRequest(BaseModel):
    paper_ids: list[str]


@router.post("/themes")
def detect_themes(body: ThemeRequest):
    papers_text = []
    for pid in body.paper_ids:
        paper = paper_store.get_paper(pid)
        if paper:
            summary = paper.get("executive_summary") or paper.get("key_findings") or ""
            papers_text.append(f"Paper: {paper.get('filename')}\n{summary[:1000]}")
    if not papers_text:
        return {"themes": []}
    combined = "\n\n---\n\n".join(papers_text)
    prompt = f"""Analyze these paper summaries and identify 3-5 recurring themes/topics across them.
For each theme, provide:
- theme: the theme name
- description: brief description
- papers: list of paper filenames that relate to this theme

Return as JSON array. Papers text:
{combined[:6000]}"""
    try:
        from ..llm_client import gemini_generate
        raw = gemini_generate(prompt, generation_config={"response_mime_type": "application/json"})
        import json as _json
        themes = _json.loads(raw)
        if isinstance(themes, list):
            return {"themes": themes[:5]}
    except Exception:
        pass
    return {"themes": []}


# ---------------------------------------------------------------------------
# Feature: Citation count from Crossref
# ---------------------------------------------------------------------------

@router.get("/citation-count/{paper_id}")
def get_citation_count(paper_id: str):
    paper = paper_store.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    meta = paper.get("metadata") or {}
    doi = meta.get("doi")
    if not doi:
        return {"citation_count": None, "source": "unavailable"}
    try:
        url = f"https://api.crossref.org/works/{doi}"
        req = urllib.request.Request(url, headers={"User-Agent": "ScholarFlow/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            count = data.get("message", {}).get("is-referenced-by-count", 0)
            return {"citation_count": count, "source": "crossref"}
    except Exception:
        return {"citation_count": None, "source": "unavailable"}


# ---------------------------------------------------------------------------
# Feature: Reading stats
# ---------------------------------------------------------------------------

@router.get("/reading-stats")
def get_reading_stats():
    papers = paper_store.list_papers()
    now = time.time()
    thirty_days = 30 * 24 * 3600
    
    total = len(papers)
    read_count = sum(1 for p in papers if (p.get("metadata") or {}).get("status") == "read")
    reading_count = sum(1 for p in papers if (p.get("metadata") or {}).get("status") == "reading")
    to_read_count = sum(1 for p in papers if (p.get("metadata") or {}).get("status") == "to_read")
    archived_count = sum(1 for p in papers if (p.get("metadata") or {}).get("status") == "archived")
    
    this_month = sum(1 for p in papers if (p.get("created_at") or 0) > now - thirty_days)
    
    all_tags = {}
    for p in papers:
        for t in (p.get("metadata") or {}).get("tags") or []:
            all_tags[t] = all_tags.get(t, 0) + 1
    top_tags = sorted(all_tags.items(), key=lambda x: -x[1])[:10]
    
    total_sections_read = 0
    for p in papers:
        progress = p.get("reading_progress") or {}
        total_sections_read += sum(1 for v in progress.values() if v)
    
    return {
        "total_papers": total,
        "read_count": read_count,
        "reading_count": reading_count,
        "to_read_count": to_read_count,
        "archived_count": archived_count,
        "papers_this_month": this_month,
        "total_sections_read": total_sections_read,
        "avg_sections_per_paper": round(total_sections_read / max(total, 1), 1),
        "top_tags": [{"tag": t, "count": c} for t, c in top_tags],
    }


@router.get("/suggest-tags")
async def suggest_tags_for_upload(paper_id: str = ""):
    from ..llm_client import gemini_generate
    prompt = (
        "Given the following paper title and abstract, suggest 5-10 relevant tags for categorization. "
        "Return only a JSON array of strings."
    )
    papers = paper_store.list_papers()
    target = None
    for p in papers:
        if p.get("id") == paper_id:
            target = p
            break
    if not target:
        raise HTTPException(404, "Paper not found")
    
    meta = target.get("metadata") or {}
    title = meta.get("title", "")
    abstract = meta.get("abstract", "")
    full = f"{prompt}\n\nTitle: {title}\nAbstract: {abstract}"
    try:
        raw = gemini_generate(full).strip()
        if "[" in raw:
            tags = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
        else:
            tags = [t.strip().strip('"') for t in raw.split(",") if t.strip()]
    except Exception:
        tags = []
    return {"suggested_tags": tags}


@router.get("/contradictions")
async def detect_contradictions(paper_ids: str = ""):
    from ..llm_client import gemini_generate
    ids = [i.strip() for i in paper_ids.split(",") if i.strip()]
    if len(ids) < 2:
        raise HTTPException(400, "Need at least 2 paper IDs")
    
    papers = paper_store.list_papers()
    selected = [p for p in papers if p.get("id") in ids]
    if len(selected) < 2:
        raise HTTPException(400, "Could not find enough papers")
    
    summaries = []
    for p in selected[:5]:
        meta = p.get("metadata") or {}
        s = p.get("detailed_summary") or p.get("executive_summary") or ""
        t = meta.get("title", "Unknown")
        summaries.append(f"Paper: {t}\nSummary: {s[:1000]}")
    
    prompt = (
        "Analyze the following paper summaries and identify any contradictions, "
        "conflicting findings, or disagreements between the papers. "
        "Return a JSON array of objects with keys: 'papers', 'contradiction', 'detail'."
    )
    try:
        raw = gemini_generate(prompt + "\n\n" + "\n\n".join(summaries)).strip()
        if "[" in raw:
            data = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
        else:
            data = []
    except Exception:
        data = []
    return {"contradictions": data, "papers_compared": len(selected[:5])}


@router.get("/research-gaps")
async def research_gaps(paper_ids: str = ""):
    from ..llm_client import gemini_generate
    ids = [i.strip() for i in paper_ids.split(",") if i.strip()]
    papers = paper_store.list_papers()
    selected = [p for p in papers if p.get("id") in ids][:10] if ids else papers[:10]
    
    summaries = []
    for p in selected:
        meta = p.get("metadata") or {}
        s = p.get("detailed_summary") or p.get("executive_summary") or ""
        t = meta.get("title", "Unknown")
        summaries.append(f"Paper: {t}\nSummary: {s[:800]}")
    
    prompt = (
        "Based on the following papers, identify 3-5 research gaps, open questions, "
        "or underexplored areas. Return a JSON array of objects with keys: 'gap', 'explanation', 'potential_direction'."
    )
    try:
        raw = gemini_generate(prompt + "\n\n" + "\n\n".join(summaries)).strip()
        if "[" in raw:
            data = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
        else:
            data = []
    except Exception:
        data = []
    return {"gaps": data, "papers_analyzed": len(selected)}


@router.get("/read-next")
async def what_to_read_next(paper_id: str = ""):
    from ..llm_client import gemini_generate
    papers = paper_store.list_papers()
    if not papers:
        return {"recommendations": [], "reasoning": "No papers in library"}
    
    target = None
    for p in papers:
        if p.get("id") == paper_id:
            target = p
            break
    
    if not target:
        return {"recommendations": [], "reasoning": "Paper not found"}
    
    all_tags = set()
    all_summaries = []
    for p in papers:
        meta = p.get("metadata") or {}
        tags = meta.get("tags") or []
        all_tags.update(tags)
        s = p.get("detailed_summary") or p.get("executive_summary") or ""
        t = meta.get("title", "Unknown")
        all_summaries.append(f"ID:{p.get('id')} Title:{t} Tags:{','.join(tags)} Summary:{s[:500]}")
    
    prompt = (
        "Given the following paper and library, recommend 5 papers from the library "
        "that would be most valuable to read next. Consider topic overlap, complementary "
        "methods, and building on prior work. Return a JSON array of objects with keys: "
        "'paper_id', 'reason'."
    )
    target_meta = target.get("metadata") or {}
    context = (
        f"Current paper: {target_meta.get('title', 'Unknown')}\n"
        f"Tags: {','.join(target_meta.get('tags', []))}\n"
        f"Summary: {(target.get('detailed_summary') or target.get('executive_summary') or '')[:500]}\n\n"
        f"Library papers:\n" + "\n".join(all_summaries[:30])
    )
    try:
        raw = gemini_generate(prompt + "\n\n" + context).strip()
        if "[" in raw:
            recs = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
        else:
            recs = []
    except Exception:
        recs = []
    return {"recommendations": recs, "reasoning": f"Based on your reading of {target_meta.get('title', 'this paper')}"}


@router.post("/import-data")
async def import_data(file: UploadFile = File(...)):
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid JSON file")
    
    papers = paper_store.list_papers()
    existing_ids = {p.get("id") for p in papers}
    existing_titles = {(p.get("metadata") or {}).get("title", "").lower() for p in papers}
    
    imported_papers = 0
    imported_collections = 0
    skipped = 0
    
    if isinstance(data, dict):
        if "papers" in data:
            for p in data["papers"]:
                pid = p.get("id")
                title = (p.get("metadata") or {}).get("title", "").lower()
                if pid in existing_ids or title in existing_titles:
                    skipped += 1
                    continue
                paper_store.save_paper(p)
                imported_papers += 1
        if "collections" in data:
            for c in data["collections"]:
                cid = c.get("id")
                if cid:
                    paper_store.db.execute(
                        "INSERT OR IGNORE INTO collections (collection_id, name, category, created_at) VALUES (?, ?, ?, ?)",
                        (cid, c.get("name", "Imported"), c.get("category", ""), time.time())
                    )
                    paper_store.db.commit()
                    imported_collections += 1
    elif isinstance(data, list):
        for p in data:
            pid = p.get("id")
            title = (p.get("metadata") or {}).get("title", "").lower()
            if pid in existing_ids or title in existing_titles:
                skipped += 1
                continue
            paper_store.save_paper(p)
            imported_papers += 1
    
    return {
        "imported_papers": imported_papers,
        "imported_collections": imported_collections,
        "skipped_duplicates": skipped,
    }


@router.post("/pin/{paper_id}")
async def toggle_pin(paper_id: str):
    p = paper_store.get_paper(paper_id)
    if not p:
        raise HTTPException(404, "Paper not found")
    meta = p.get("metadata") or {}
    meta["pinned"] = not meta.get("pinned", False)
    p["metadata"] = meta
    paper_store.db.execute("UPDATE papers SET metadata = ? WHERE paper_id = ?", (json.dumps(meta), paper_id))
    paper_store.db.commit()
    return {"pinned": meta.get("pinned", False)}


@router.post("/collections/{collection_id}/color")
async def update_collection_color(collection_id: str, body: dict):
    color = body.get("color", "#3525cd")
    paper_store.db.execute(
        "UPDATE collections SET color = ? WHERE collection_id = ?", (color, collection_id)
    )
    paper_store.db.commit()
    return {"ok": True, "color": color}
