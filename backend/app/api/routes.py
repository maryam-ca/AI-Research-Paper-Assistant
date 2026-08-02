import uuid
import tempfile
import os
import time
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel

from backend.app.ingestion.metadata_fetcher import fetch_arxiv_metadata, fetch_doi_metadata
from backend.app.processing.graph import build_graph
from backend.app.processing.qa import answer_question
from backend.app.processing.compare import compare_papers
from backend.app.processing.citations import generate_citation

router = APIRouter(prefix="/api/papers", tags=["papers"])

_library: dict[str, dict] = {}
_graph = None


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


class QuestionRequest(BaseModel):
    question: str


class CompareRequest(BaseModel):
    paper_ids: list[str]


@router.post("/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    paper_id = uuid.uuid4().hex[:12]
    suffix = os.path.splitext(file.filename)[1]

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = _run_pipeline(tmp_path, paper_id)
    finally:
        os.unlink(tmp_path)

    _library[paper_id] = {
        "id": paper_id,
        "filename": file.filename,
        "metadata": None,
        "executive_summary": result["executive_summary"],
        "detailed_summary": result["detailed_summary"],
        "key_findings": result["key_findings"],
        "key_elements": result["key_elements"],
        "attribution_report": result["attribution_report"],
        "created_at": result["created_at"],
    }

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
    else:
        metadata = fetch_doi_metadata(doi)

    paper_id = uuid.uuid4().hex[:12]

    # For fetched papers, we store metadata and summaries from the LLM.
    # If a PDF URL is available, the caller can upload the file separately.
    _library[paper_id] = {
        "id": paper_id,
        "filename": metadata["title"],
        "metadata": metadata,
        "executive_summary": None,
        "detailed_summary": None,
        "key_findings": None,
        "key_elements": None,
        "attribution_report": None,
        "created_at": time.time(),
    }

    return {
        "paper_id": paper_id,
        "metadata": metadata,
    }


@router.get("")
def list_papers():
    return list(_library.values())


@router.get("/{paper_id}")
def get_paper(paper_id: str):
    paper = _library.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.post("/{paper_id}/ask")
def ask_question(paper_id: str, body: QuestionRequest):
    if paper_id not in _library:
        raise HTTPException(status_code=404, detail="Paper not found")
    return answer_question(paper_id, body.question)


@router.post("/compare")
def compare(body: CompareRequest):
    if len(body.paper_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two paper IDs required")
    missing = [pid for pid in body.paper_ids if pid not in _library]
    if missing:
        raise HTTPException(status_code=404, detail=f"Papers not found: {missing}")
    return compare_papers(body.paper_ids)


@router.get("/{paper_id}/citation")
def citation(paper_id: str, style: str = Query("apa")):
    paper = _library.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper["metadata"]:
        raise HTTPException(status_code=400, detail="No metadata available for this paper")
    try:
        return {"citation": generate_citation(paper["metadata"], style)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cleanup")
def cleanup_expired():
    from backend.app.storage.vector_store import purge_expired
    cutoff = time.time() - (30 * 86400)
    expired_ids = [pid for pid, p in _library.items() if p.get("created_at", 0) < cutoff]
    deleted_vectors = 0
    for pid in expired_ids:
        del _library[pid]
        deleted_vectors += purge_expired(max_age_days=30)
    return {"deleted_papers": len(expired_ids), "deleted_chunks": deleted_vectors}
