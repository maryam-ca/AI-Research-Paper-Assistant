"""All API routes for the Research Paper Analysis Agent."""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, extract, func

from database import get_db
from models import (
    Paper, Summary, KeyElements, Chunk, QAHistory,
    Collection, CollectionPaper, Note, Activity, Highlight, ResearchQuestion,
)
from file_handler import upload_bytes, download_bytes, generate_thumbnail
from metadata_fetcher import fetch_arxiv_metadata, fetch_doi_metadata, fetch_url_metadata
from pipeline import analyze_paper, compare_papers
from qa_agent import answer_question
from extractor import FIELDS
from synthesis import generate_literature_review, generate_digest, generate_compare_matrix, translate_text
from vectorstore import similar_papers

logger = logging.getLogger("routes")
router = APIRouter(prefix="/api")
security_router = router


def pid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid paper id")


def _serialize_paper(p: Paper) -> dict:
    return {
        "id": str(p.id),
        "title": p.title,
        "authors": p.authors or [],
        "abstract": p.abstract,
        "source_type": p.source_type,
        "source_id": p.source_id,
        "upload_date": p.upload_date.isoformat() if p.upload_date else None,
        "thumbnail_url": p.thumbnail_url,
        "file_url": p.file_url,
        "reading_status": p.reading_status or "not_started",
        "started_reading_at": p.started_reading_at.isoformat() if p.started_reading_at else None,
        "last_read_at": p.last_read_at.isoformat() if p.last_read_at else None,
        "completed_reading_at": p.completed_reading_at.isoformat() if p.completed_reading_at else None,
        "keywords": p.keywords or [],
        "readability_score": p.readability_score,
        "complexity_level": p.complexity_level,
        "page_count": p.page_count,
        "reading_time_minutes": p.reading_time_minutes,
        "rigor_score": p.rigor_score,
        "bias_risk": p.bias_risk,
        "reproducibility_score": p.reproducibility_score,
        "quality_flags": p.quality_flags or [],
    }


# ---------------- Papers ----------------

@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/papers/upload")
async def upload_paper(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    name = (file.filename or "upload").lower()
    if name.endswith(".pdf"):
        source_type = "pdf"
    elif name.endswith(".docx"):
        source_type = "docx"
    else:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX are supported")

    file_url = upload_bytes(data, f"papers/{uuid.uuid4()}-{name}", file.content_type or "application/pdf")
    title = file.filename or "Untitled"
    thumb = generate_thumbnail(title, str(uuid.uuid4()))
    thumb_url = upload_bytes(thumb, f"thumbs/{uuid.uuid4()}.jpg", "image/jpeg")

    paper = Paper(
        title=title, source_type=source_type, source_id=file_url,
        file_url=file_url, thumbnail_url=thumb_url,
    )
    db.add(paper)
    db.flush()  # assign paper.id before creating dependent rows
    db.add(Activity(paper_id=paper.id, action="upload", details=title))
    db.commit()
    db.refresh(paper)
    return _serialize_paper(paper)


@router.post("/papers/fetch")
async def fetch_paper(payload: dict = Body(...), db: Session = Depends(get_db)):
    source = payload.get("source")
    value = payload.get("value")
    if not source or not value:
        raise HTTPException(status_code=400, detail="source and value required")

    if source == "arxiv":
        meta = fetch_arxiv_metadata(value)
    elif source == "doi":
        meta = fetch_doi_metadata(value)
    elif source == "url":
        meta = fetch_url_metadata(value)
    else:
        raise HTTPException(status_code=400, detail="source must be arxiv, doi or url")

    paper_bytes = b""
    if meta.get("pdf_url"):
        try:
            paper_bytes = download_bytes(meta["pdf_url"])
        except Exception as e:  # noqa: BLE001
            logger.warning("Could not download PDF: %s", e)

    file_url = None
    if paper_bytes:
        file_url = upload_bytes(paper_bytes, f"papers/{uuid.uuid4()}.pdf", "application/pdf")

    thumb = generate_thumbnail(meta["title"], str(uuid.uuid4()))
    thumb_url = upload_bytes(thumb, f"thumbs/{uuid.uuid4()}.jpg", "image/jpeg")

    paper = Paper(
        title=meta["title"], authors=meta.get("authors"),
        abstract=meta.get("abstract"), source_type=source,
        source_id=meta.get("source_id"), file_url=file_url,
        thumbnail_url=thumb_url,
    )
    db.add(paper)
    db.flush()  # assign paper.id before creating dependent rows
    db.add(Activity(paper_id=paper.id, action="upload", details=f"fetched {source}"))
    db.commit()
    db.refresh(paper)
    return _serialize_paper(paper)


@router.get("/papers")
def list_papers(db: Session = Depends(get_db)):
    papers = db.query(Paper).order_by(Paper.upload_date.desc()).all()
    return [_serialize_paper(p) for p in papers]


@router.get("/papers/{paper_id}")
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    return _serialize_paper(p)


@router.delete("/papers/{paper_id}")
def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    db.delete(p)
    db.commit()
    return {"deleted": True}


@router.post("/papers/{paper_id}/analyze")
async def analyze(paper_id: str, db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not p.file_url:
        raise HTTPException(status_code=400, detail="No source file for this paper")
    data = download_bytes(p.file_url)
    result = analyze_paper(db, p.id, data, p.source_type or "pdf")
    return {"paper_id": paper_id, **result}


@router.get("/papers/{paper_id}/summary")
def get_summary(paper_id: str, db: Session = Depends(get_db)):
    s = db.query(Summary).filter(Summary.paper_id == pid(paper_id)).order_by(Summary.generated_at.desc()).first()  # noqa
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found. Run /analyze first.")
    return {
        "executive_summary": s.executive_summary,
        "detailed_summary": s.detailed_summary,
        "key_findings": s.key_findings or [],
        "model_used": s.model_used,
        "generated_at": s.generated_at.isoformat() if s.generated_at else None,
    }


@router.get("/papers/{paper_id}/elements")
def get_elements(paper_id: str, db: Session = Depends(get_db)):
    e = db.query(KeyElements).filter(KeyElements.paper_id == pid(paper_id)).order_by(KeyElements.extracted_at.desc()).first()
    if not e:
        raise HTTPException(status_code=404, detail="Elements not found. Run /analyze first.")
    return {
        "problem": e.problem, "methodology": e.methodology,
        "results": e.results, "limitations": e.limitations,
        "contributions": e.contributions, "future_work": e.future_work,
    }


@router.post("/papers/{paper_id}/question")
def ask_question(paper_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    question = payload.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="question required")
    try:
        result = answer_question(db, pid(paper_id), question)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    qa = QAHistory(paper_id=pid(paper_id), question=question,
                   answer=result["answer"], cited_pages=result["cited_pages"])
    db.add(qa)
    db.add(Activity(paper_id=pid(paper_id), action="question", details=question[:120]))
    db.commit()
    return result


@router.get("/papers/{paper_id}/questions")
def get_questions(paper_id: str, db: Session = Depends(get_db)):
    rows = db.query(QAHistory).filter(QAHistory.paper_id == pid(paper_id)).order_by(QAHistory.created_at.asc()).all()
    return [{"question": r.question, "answer": r.answer, "cited_pages": r.cited_pages or []} for r in rows]


@router.post("/papers/compare")
def compare(payload: dict = Body(...), db: Session = Depends(get_db)):
    ids = payload.get("paper_ids") or []
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two paper_ids")
    try:
        return compare_papers(db, [pid(i) for i in ids])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/papers/{paper_id}/related")
def related_papers(paper_id: str, db: Session = Depends(get_db)):
    target = pid(paper_id)
    # Papers sharing a collection with this one
    sub = db.query(CollectionPaper.collection_id).filter(CollectionPaper.paper_id == target).subquery()
    related = (
        db.query(Paper)
        .join(CollectionPaper, CollectionPaper.paper_id == Paper.id)
        .filter(CollectionPaper.collection_id.in_(sub))
        .filter(Paper.id != target)
        .all()
    )
    return [_serialize_paper(p) for p in related]


@router.get("/papers/{paper_id}/thumbnail")
def get_thumbnail(paper_id: str, db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    if p.thumbnail_url:
        try:
            data = download_bytes(p.thumbnail_url)
            return Response(content=data, media_type="image/jpeg")
        except Exception:  # noqa: BLE001
            pass
    data = generate_thumbnail(p.title, paper_id)
    return Response(content=data, media_type="image/jpeg")


@router.post("/papers/{paper_id}/thumbnail")
async def set_thumbnail(paper_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    data = await file.read()
    url = upload_bytes(data, f"thumbs/{uuid.uuid4()}.jpg", "image/jpeg")
    p.thumbnail_url = url
    db.commit()
    return {"thumbnail_url": url}


@router.get("/papers/{paper_id}/export")
def export_markdown(paper_id: str, format: str = "markdown", db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    s = db.query(Summary).filter(Summary.paper_id == p.id).order_by(Summary.generated_at.desc()).first()
    e = db.query(KeyElements).filter(KeyElements.paper_id == p.id).first()

    md = f"# {p.title}\n\n**Authors:** {', '.join(p.authors or [])}\n\n"
    if s:
        md += f"## Executive Summary\n{s.executive_summary}\n\n## Detailed Summary\n{s.detailed_summary}\n\n"
        if s.key_findings:
            md += "## Key Findings\n" + "\n".join(f"- {f}" for f in s.key_findings) + "\n\n"
    if e:
        md += "## Key Elements\n"
        for label, val in [("Problem", e.problem), ("Methodology", e.methodology),
                           ("Results", e.results), ("Limitations", e.limitations),
                           ("Contributions", e.contributions), ("Future Work", e.future_work)]:
            if val:
                md += f"### {label}\n{val}\n\n"

    if format == "obsidian":
        # Obsidian-friendly: wikilink keywords, link back to collection note
        obs = f"---\ntags: [scholarflow, paper]\n---\n\n{md}"
        for k in (p.keywords or []):
            obs += f"\n#[[{k.replace(' ', '_')}]]"
        return Response(content=obs, media_type="text/markdown")

    if format == "notion":
        notion = {
            "parent": {"type": "database_id", "database_id": "REPLACE_WITH_NOTION_DB"},
            "properties": {
                "Title": {"title": [{"text": {"content": p.title}}]},
                "Authors": {"rich_text": [{"text": {"content": ', '.join(p.authors or [])}}]},
                "Source": {"select": {"name": p.source_type or "pdf"}},
                "Keywords": {"multi_select": [{"name": k} for k in (p.keywords or [])]},
            },
            "children": [
                {"object": "block", "type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Executive Summary"}}]}},
                {"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": s.executive_summary if s else ""}}]}},
            ],
        }
        return notion

    return Response(content=md, media_type="text/markdown")


# ---------------- Search & Discovery (Tier 1.1) ----------------

@router.get("/papers/search")
def search_papers(
    q: Optional[str] = None,
    source_type: Optional[str] = None,
    complexity: Optional[str] = None,
    status: Optional[str] = None,
    year: Optional[int] = None,
    sort: Optional[str] = "newest",
    db: Session = Depends(get_db),
):
    query = db.query(Paper)
    if q:
        qlike = f"%{q.strip().lower()}%"
        chunk_sub = db.query(Chunk.paper_id).filter(Chunk.chunk_text.ilike(qlike)).subquery()
        query = query.filter(
            or_(
                Paper.title.ilike(qlike),
                Paper.abstract.ilike(qlike),
                Paper.authors.any(qlike),
                Paper.keywords.any(qlike),
                Paper.id.in_(chunk_sub),
            )
        )
    if source_type:
        query = query.filter(Paper.source_type == source_type)
    if complexity:
        query = query.filter(Paper.complexity_level == complexity)
    if status:
        query = query.filter(Paper.reading_status == status)
    if year:
        query = query.filter(extract("year", Paper.upload_date) == int(year))
    if sort == "title":
        query = query.order_by(Paper.title.asc())
    else:
        query = query.order_by(Paper.upload_date.desc())
    return [_serialize_paper(p) for p in query.all()]


# ---------------- Reading status (Tier 1.2) ----------------

VALID_STATUS = {"not_started", "reading", "reviewed", "completed"}


@router.patch("/papers/{paper_id}/status")
def set_status(paper_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    status = payload.get("status")
    if status and status not in VALID_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")
    now = func.now()
    if status:
        p.reading_status = status
        if status == "reading" and not p.started_reading_at:
            p.started_reading_at = now
        if status == "completed":
            p.completed_reading_at = now
    p.last_read_at = now
    if "progress" in payload:
        # progress is informational; last_read_at captures the activity
        pass
    db.commit()
    db.refresh(p)
    return _serialize_paper(p)


# ---------------- Follow-up questions (Tier 1.6) ----------------

@router.post("/papers/{paper_id}/suggest-questions")
def suggest_questions(paper_id: str, payload: dict = Body({}), db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    previous = payload.get("previous_question")
    return {"suggestions": answer_question(db, pid(paper_id), None, suggest=True, previous=previous)}


# ---------------- Highlights (Tier 1.7) ----------------

@router.post("/papers/{paper_id}/highlights")
def add_highlight(paper_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    h = Highlight(
        paper_id=pid(paper_id),
        text=payload.get("text", ""),
        page_number=payload.get("page_number"),
        color=payload.get("color", "yellow"),
        note=payload.get("note"),
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": str(h.id), "text": h.text, "page_number": h.page_number,
            "color": h.color, "note": h.note, "created_at": h.created_at.isoformat() if h.created_at else None}


@router.get("/papers/{paper_id}/highlights")
def get_highlights(paper_id: str, db: Session = Depends(get_db)):
    rows = db.query(Highlight).filter(Highlight.paper_id == pid(paper_id)).order_by(Highlight.created_at.desc()).all()
    return [{"id": str(r.id), "text": r.text, "page_number": r.page_number,
             "color": r.color, "note": r.note, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@router.delete("/papers/{paper_id}/highlights/{highlight_id}")
def delete_highlight(paper_id: str, highlight_id: str, db: Session = Depends(get_db)):
    h = db.get(Highlight, pid(highlight_id))
    if h:
        db.delete(h)
        db.commit()
    return {"deleted": True}


# ---------------- Tier 2: Synthesis & discovery ----------------

@router.get("/papers/{paper_id}/similar")
def similar_papers_endpoint(paper_id: str, limit: int = 5, db: Session = Depends(get_db)):
    res = similar_papers(db, pid(paper_id), limit)
    return [{"paper": _serialize_paper(p), "score": round(score, 3)} for p, score in res]


@router.post("/collections/{collection_id}/generate-literature-review")
def generate_lr(collection_id: str, payload: dict = Body({}), db: Session = Depends(get_db)):
    cid = uuid.UUID(collection_id)
    c = db.get(Collection, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")

    rows = db.query(CollectionPaper).filter(CollectionPaper.collection_id == cid).all()
    paper_ids = [r.paper_id for r in rows]
    if payload.get("paper_ids"):
        wanted = {uuid.UUID(x) for x in payload["paper_ids"]}
        paper_ids = [pid for pid in paper_ids if pid in wanted]

    papers = [db.get(Paper, pid) for pid in paper_ids]
    papers = [p for p in papers if p]
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in this collection")

    blocks = []
    for p in papers:
        s = db.query(Summary).filter(Summary.paper_id == p.id).order_by(Summary.generated_at.desc()).first()
        e = db.query(KeyElements).filter(KeyElements.paper_id == p.id).first()
        part = f"# {p.title}\n"
        if s:
            part += f"Executive summary: {s.executive_summary}\n"
            if s.key_findings:
                part += "Key findings: " + "; ".join(s.key_findings) + "\n"
        if e:
            part += ("Methodology: " + (e.methodology or "") + "\n"
                     "Results: " + (e.results or "") + "\n"
                     "Limitations: " + (e.limitations or "") + "\n")
        blocks.append(part)
    block = "\n\n".join(blocks)
    tone = payload.get("tone") or "academic"
    length = payload.get("length") or "standard"
    lr = generate_literature_review(block, tone=tone, length=length)
    return {"collection": c.name, "paper_count": len(papers), **lr}


@router.post("/digest")
def generate_digest_endpoint(payload: dict = Body({}), db: Session = Depends(get_db)):
    from datetime import datetime, timedelta

    freq = (payload.get("frequency") or "weekly").lower()
    days = {"daily": 1, "monthly": 30}.get(freq, 7)
    since = datetime.now() - timedelta(days=days)

    q = db.query(Paper).filter(Paper.upload_date >= since)
    if payload.get("collection_id"):
        cid = uuid.UUID(payload["collection_id"])
        in_coll = db.query(CollectionPaper.paper_id).filter(CollectionPaper.collection_id == cid).subquery()
        q = q.filter(Paper.id.in_(in_coll))
    recent = q.order_by(Paper.upload_date.desc()).all()

    acts = db.query(Activity).filter(Activity.timestamp >= since).all()
    completed_ids = {a.paper_id for a in acts if a.action == "analyze"}

    block = f"Period: last {days} days\n"
    block += "Papers added:\n" + (
        "\n".join(f"- {p.title} ({p.source_type})" for p in recent) or "- none"
    ) + "\n"
    block += "Recent activity count: " + str(len(acts)) + "\n"
    if recent:
        block += "Topics: " + ", ".join(sorted({k for p in recent for k in (p.keywords or [])}))[:500] + "\n"
    md = generate_digest(block)
    return {"frequency": freq, "paper_count": len(recent), "markdown": md}


@router.post("/papers/compare-matrix")
def compare_matrix_endpoint(payload: dict = Body(...), db: Session = Depends(get_db)):
    ids = payload.get("paper_ids") or []
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two paper_ids")
    papers = [db.get(Paper, pid(i)) for i in ids]
    papers = [p for p in papers if p]
    blocks = []
    for p in papers:
        s = db.query(Summary).filter(Summary.paper_id == p.id).order_by(Summary.generated_at.desc()).first()
        e = db.query(KeyElements).filter(KeyElements.paper_id == p.id).first()
        part = f"id={p.id}\ntitle={p.title}\n"
        if s:
            part += f"summary={s.executive_summary}\n"
        if e:
            part += f"methodology={e.methodology}\nresults={e.results}\n"
        blocks.append(part)
    rows = generate_compare_matrix("\n\n".join(blocks))
    return {"rows": rows}


# ---------------- Tier 3 endpoints ----------------

def _serialize_rq(r: ResearchQuestion) -> dict:
    return {
        "id": str(r.id),
        "collection_id": str(r.collection_id),
        "question_text": r.question_text,
        "hypothesis": r.hypothesis,
        "status": r.status or "active",
        "paper_ids": r.paper_ids or [],
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# 3.1 Research questions & hypotheses
@router.post("/collections/{collection_id}/research-questions")
def add_rq(collection_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    cid = uuid.UUID(collection_id)
    if not db.get(Collection, cid):
        raise HTTPException(status_code=404, detail="Collection not found")
    rq = ResearchQuestion(
        collection_id=cid,
        question_text=payload.get("question_text", ""),
        hypothesis=payload.get("hypothesis"),
        paper_ids=payload.get("paper_ids") or [],
        status=payload.get("status", "active"),
    )
    db.add(rq)
    db.commit()
    db.refresh(rq)
    return _serialize_rq(rq)


@router.get("/collections/{collection_id}/research-questions")
def list_rq(collection_id: str, db: Session = Depends(get_db)):
    cid = uuid.UUID(collection_id)
    rows = db.query(ResearchQuestion).filter(ResearchQuestion.collection_id == cid).order_by(ResearchQuestion.created_at.desc()).all()
    return [_serialize_rq(r) for r in rows]


@router.patch("/research-questions/{rq_id}")
def patch_rq(rq_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    r = db.get(ResearchQuestion, pid(rq_id))
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("question_text", "hypothesis", "status", "paper_ids"):
        if field in payload:
            setattr(r, field, payload[field])
    db.commit()
    db.refresh(r)
    return _serialize_rq(r)


@router.delete("/research-questions/{rq_id}")
def del_rq(rq_id: str, db: Session = Depends(get_db)):
    r = db.get(ResearchQuestion, pid(rq_id))
    if r:
        db.delete(r)
        db.commit()
    return {"deleted": True}


# 3.4 Analytics dashboard
@router.get("/analytics/dashboard")
def analytics_dashboard(collection_id: Optional[str] = None, db: Session = Depends(get_db)):
    from collections import Counter

    q = db.query(Paper)
    if collection_id:
        cid = uuid.UUID(collection_id)
        sub = db.query(CollectionPaper.paper_id).filter(CollectionPaper.collection_id == cid).subquery()
        q = q.filter(Paper.id.in_(sub))
    papers = q.all()

    topic_counts = Counter(k for p in papers for k in (p.keywords or []))
    monthly = Counter(f"{p.upload_date.year}-{p.upload_date.month:02d}" for p in papers if p.upload_date)
    rigors = [p.rigor_score for p in papers if p.rigor_score is not None]
    repro = [p.reproducibility_score for p in papers if p.reproducibility_score is not None]
    avg = lambda xs: round(sum(xs) / len(xs), 1) if xs else None

    return {
        "total": len(papers),
        "top_topics": topic_counts.most_common(15),
        "source_distribution": dict(Counter(p.source_type for p in papers)),
        "complexity_distribution": dict(Counter(p.complexity_level for p in papers)),
        "status_distribution": dict(Counter(p.reading_status or "not_started" for p in papers)),
        "bias_distribution": dict(Counter(p.bias_risk or "medium" for p in papers)),
        "monthly_added": dict(sorted(monthly.items())),
        "avg_rigor": avg(rigors),
        "avg_reproducibility": avg(repro),
    }


# 3.7 Translate paper content
@router.post("/papers/{paper_id}/translate")
def translate_paper(paper_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    p = db.get(Paper, pid(paper_id))
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    lang = payload.get("target_language") or "es"
    s = db.query(Summary).filter(Summary.paper_id == p.id).order_by(Summary.generated_at.desc()).first()
    e = db.query(KeyElements).filter(KeyElements.paper_id == p.id).first()
    out = {"target_language": lang}
    if s:
        out["executive_summary"] = translate_text(s.executive_summary, lang)
        out["detailed_summary"] = translate_text(s.detailed_summary, lang)
        out["key_findings"] = [translate_text(f, lang) for f in (s.key_findings or [])]
    if e:
        out["key_elements"] = {f: translate_text(getattr(e, f, "") or "", lang) for f in FIELDS}
    return out


# 3.2 Quick-add from a link (used by Chrome extension / bookmarklet)
@router.post("/papers/quick-add")
async def quick_add(payload: dict = Body(...), db: Session = Depends(get_db)):
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    meta = fetch_url_metadata(url)
    paper_bytes = b""
    if meta.get("pdf_url"):
        try:
            paper_bytes = download_bytes(meta["pdf_url"])
        except Exception as e:  # noqa: BLE001
            logger.warning("quick-add download failed: %s", e)
    file_url = None
    if paper_bytes:
        file_url = upload_bytes(paper_bytes, f"papers/{uuid.uuid4()}.pdf", "application/pdf")
    thumb = generate_thumbnail(meta["title"], str(uuid.uuid4()))
    thumb_url = upload_bytes(thumb, f"thumbs/{uuid.uuid4()}.jpg", "image/jpeg")
    paper = Paper(
        title=meta["title"], authors=meta.get("authors"), abstract=meta.get("abstract"),
        source_type="url", source_id=url, file_url=file_url, thumbnail_url=thumb_url,
    )
    db.add(paper)
    db.flush()
    db.add(Activity(paper_id=paper.id, action="upload", details=meta["title"]))
    if file_url:
        try:
            analyze_paper(db, paper.id, paper_bytes, "url")
        except Exception as e:  # noqa: BLE001
            logger.warning("quick-add analysis failed: %s", e)
    db.commit()
    db.refresh(paper)
    return _serialize_paper(paper)


# ---------------- Collections ----------------

@router.post("/collections")
def create_collection(payload: dict = Body(...), db: Session = Depends(get_db)):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    existing = db.query(Collection).filter(Collection.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Collection name already exists")
    c = Collection(name=name, description=payload.get("description"),
                   category=payload.get("category"))
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": str(c.id), "name": c.name, "description": c.description, "category": c.category}


@router.get("/collections")
def list_collections(db: Session = Depends(get_db)):
    cols = db.query(Collection).order_by(Collection.created_at.desc()).all()
    out = []
    for c in cols:
        count = db.query(CollectionPaper).filter(CollectionPaper.collection_id == c.id).count()
        out.append({"id": str(c.id), "name": c.name, "description": c.description,
                    "category": c.category, "paper_count": count})
    return out


@router.post("/collections/{collection_id}/papers")
def add_to_collection(collection_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    paper_id = payload.get("paper_id")
    if not paper_id:
        raise HTTPException(status_code=400, detail="paper_id required")
    cid = uuid.UUID(collection_id)
    pid_val = pid(paper_id)
    exists = db.query(CollectionPaper).filter(
        CollectionPaper.collection_id == cid, CollectionPaper.paper_id == pid_val).first()
    if not exists:
        db.add(CollectionPaper(collection_id=cid, paper_id=pid_val))
        db.commit()
    return {"added": True}


@router.delete("/collections/{collection_id}/papers")
def remove_from_collection(collection_id: str, paper_id: str, db: Session = Depends(get_db)):
    cid = uuid.UUID(collection_id)
    pid_val = pid(paper_id)
    row = db.query(CollectionPaper).filter(
        CollectionPaper.collection_id == cid, CollectionPaper.paper_id == pid_val).first()
    if row:
        db.delete(row)
        db.commit()
    return {"removed": True}


@router.get("/collections/{collection_id}/papers")
def collection_papers(collection_id: str, db: Session = Depends(get_db)):
    cid = uuid.UUID(collection_id)
    rows = db.query(CollectionPaper).filter(CollectionPaper.collection_id == cid).all()
    papers = [db.get(Paper, r.paper_id) for r in rows]
    return [_serialize_paper(p) for p in papers if p]


@router.post("/collections/{collection_id}/export")
def export_collection(collection_id: str, payload: dict = Body({}), db: Session = Depends(get_db)):
    from datetime import datetime

    cid = uuid.UUID(collection_id)
    c = db.get(Collection, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    out_format = (payload.get("format") or "markdown").lower()

    rows = db.query(CollectionPaper).filter(CollectionPaper.collection_id == cid).all()
    papers = [db.get(Paper, r.paper_id) for r in rows]
    papers = [p for p in papers if p]

    md = f"# Reading List: {c.name}\n\n"
    if c.description:
        md += f"{c.description}\n\n"
    md += f"_Exported {datetime.now().date()} - {len(papers)} papers_\n\n---\n\n"

    for idx, p in enumerate(papers, 1):
        s = db.query(Summary).filter(Summary.paper_id == p.id).order_by(Summary.generated_at.desc()).first()
        e = db.query(KeyElements).filter(KeyElements.paper_id == p.id).first()
        md += f"## {idx}. {p.title}\n"
        md += f"**Authors:** {', '.join(p.authors or [])}\n"
        md += f"**Source:** {p.source_type}"
        if p.reading_time_minutes:
            md += f" - ~{p.reading_time_minutes} min read"
        if p.complexity_level:
            md += f" - complexity: {p.complexity_level}"
        md += "\n"
        if p.keywords:
            md += f"**Keywords:** {', '.join(p.keywords)}\n"
        if p.abstract:
            md += f"\n> {p.abstract}\n"
        if s:
            md += f"\n{s.executive_summary}\n"
            if s.key_findings:
                md += "\n**Key findings:**\n" + "\n".join(f"- {f}" for f in s.key_findings) + "\n"
        if e:
            for label, val in [("Problem", e.problem), ("Methodology", e.methodology),
                               ("Results", e.results), ("Limitations", e.limitations),
                               ("Contributions", e.contributions), ("Future Work", e.future_work)]:
                if val:
                    md += f"\n### {label}\n{val}\n"
        md += "\n---\n\n"

    if out_format == "bibtex":
        bib = "\n".join(
            f"@article{{paper_{idx},\n  title = {{{p.title}}},\n  author = {{{' and '.join(p.authors or [])}}},\n  note = {{ScholarFlow reading list: {c.name}}}\n}}"
            for idx, p in enumerate(papers, 1)
        )
        return Response(content=bib, media_type="application/x-bibtex")

    return Response(content=md, media_type="text/markdown")


# ---------------- Notes ----------------

@router.post("/papers/{paper_id}/notes")
def add_note(paper_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    tags = payload.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    n = Note(paper_id=pid(paper_id), note_text=payload.get("note_text"), tags=tags)
    db.add(n)
    db.add(Activity(paper_id=pid(paper_id), action="tag", details=(payload.get("note_text") or "")[:120]))
    db.commit()
    db.refresh(n)
    return {"id": str(n.id), "note_text": n.note_text, "tags": n.tags or []}


@router.get("/papers/{paper_id}/notes")
def get_notes(paper_id: str, db: Session = Depends(get_db)):
    rows = db.query(Note).filter(Note.paper_id == pid(paper_id)).order_by(Note.created_at.desc()).all()
    return [{"id": str(r.id), "note_text": r.note_text, "tags": r.tags or []} for r in rows]


# ---------------- Activity ----------------

@router.post("/papers/{paper_id}/activity")
def log_activity(paper_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    a = Activity(paper_id=pid(paper_id), action=payload.get("action", "favorite"),
                 details=payload.get("details"))
    db.add(a)
    db.commit()
    return {"logged": True}


@router.get("/papers/{paper_id}/activity")
def get_activity(paper_id: str, db: Session = Depends(get_db)):
    rows = db.query(Activity).filter(Activity.paper_id == pid(paper_id)).order_by(Activity.timestamp.desc()).all()
    return [{"action": r.action, "details": r.details,
             "timestamp": r.timestamp.isoformat() if r.timestamp else None} for r in rows]


@router.get("/activity")
def global_activity(db: Session = Depends(get_db)):
    rows = (
        db.query(Activity, Paper.title)
        .join(Paper, Paper.id == Activity.paper_id)
        .order_by(Activity.timestamp.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "action": a.action,
            "details": a.details,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "paper_id": str(a.paper_id),
            "paper_title": title,
        }
        for a, title in rows
    ]
