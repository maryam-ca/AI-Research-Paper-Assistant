"""Full analysis pipeline: extract -> chunk -> embed -> summarize -> extract elements."""
import logging
from models import Paper, Summary, KeyElements, Activity, Chunk
from document_processor import process_document, chunk_text
from vectorstore import store_embeddings
from summarizer import (
    generate_executive_summary,
    generate_detailed_summary,
    extract_key_findings,
)
from extractor import extract_key_elements, FIELDS
from llm_client import generate_with_fallback
from utils import fill, extract_json

logger = logging.getLogger("pipeline")


def analyze_paper(db, paper_id, file_bytes: bytes, source_type: str) -> dict:
    # Upsert: clear any prior analysis for this paper so re-runs stay clean.
    db.query(Chunk).filter(Chunk.paper_id == paper_id).delete()
    db.query(Summary).filter(Summary.paper_id == paper_id).delete()
    db.query(KeyElements).filter(KeyElements.paper_id == paper_id).delete()
    db.commit()

    pages, full_text = process_document(file_bytes, source_type)
    if not full_text.strip():
        raise ValueError("Could not extract any text from the document.")

    # Chunk by page-aware concatenation, then store embeddings
    chunks = []
    order = 0
    for page in pages:
        for c in chunk_text(page["text"]):
            chunks.append({"text": c, "page": page["page"], "order": order})
            order += 1
    store_embeddings(db, paper_id, chunks)

    # Summaries
    exec_sum = generate_executive_summary(full_text)
    det_sum = generate_detailed_summary(full_text)
    findings = extract_key_findings(full_text)

    summary = Summary(
        paper_id=paper_id,
        executive_summary=exec_sum,
        detailed_summary=det_sum,
        key_findings=findings,
        model_used="gemini-2.5-flash",
    )
    db.add(summary)

    # Key elements
    elements = extract_key_elements(full_text)
    element_kwargs = {f: elements.get(f, "") for f in FIELDS}
    db.add(KeyElements(paper_id=paper_id, **element_kwargs))

    # Mirror per-paper metadata onto the Paper row (for filtering/display)
    paper = db.get(Paper, paper_id)
    if paper is not None:
        paper.keywords = elements.get("keywords") or []
        paper.readability_score = elements.get("readability_score")
        paper.complexity_level = elements.get("complexity_level")
        paper.rigor_score = elements.get("rigor_score")
        paper.bias_risk = elements.get("bias_risk")
        paper.reproducibility_score = elements.get("reproducibility_score")
        paper.quality_flags = elements.get("quality_flags") or []
        paper.page_count = len(pages)
        paper.reading_time_minutes = len(pages) * 2

    # Activity log
    db.add(Activity(paper_id=paper_id, action="analyze",
                    details="Full pipeline completed"))
    db.commit()

    return {
        "executive_summary": exec_sum,
        "detailed_summary": det_sum,
        "key_findings": findings,
        "key_elements": elements,
    }


COMPARE_TEMPLATE = """Compare these research papers. Respond ONLY with a JSON
object with keys: methodologies (object mapping paper title->string),
findings (object mapping title->array of strings),
differences (array of strings highlighting contrasts).

PAPERS:
{{papers}}"""

DIFF_FIELDS = ["problem", "methodology", "results", "limitations", "contributions", "future_work"]


def compare_papers(db, paper_ids: list) -> dict:
    from models import Paper, KeyElements, Summary
    papers = []
    for pid in paper_ids:
        p = db.get(Paper, pid)
        els = db.query(KeyElements).filter(KeyElements.paper_id == pid).first()
        summ = db.query(Summary).filter(Summary.paper_id == pid).first()
        papers.append({
            "id": str(pid),
            "title": p.title if p else "Unknown",
            "authors": p.authors if p else [],
            "elements": {
                f: (getattr(els, f) if els else "") for f in DIFF_FIELDS
            },
            "executive_summary": summ.executive_summary if summ else "",
        })
    if len(papers) < 2:
        raise ValueError("Provide at least two paper ids to compare")

    block = "\n\n".join(
        f"TITLE: {p['title']}\nELEMENTS: {p['elements']}" for p in papers
    )
    prompt = fill(COMPARE_TEMPLATE, papers=block)
    text, _ = generate_with_fallback(prompt, max_tokens=2000)
    data = extract_json(text) or {}
    return {
        "papers": [{"id": p["id"], "title": p["title"], "authors": p["authors"]} for p in papers],
        "methodologies": data.get("methodologies", {}),
        "findings": data.get("findings", {}),
        "differences": data.get("differences", []),
    }
