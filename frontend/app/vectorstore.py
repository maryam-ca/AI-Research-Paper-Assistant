"""Vector store: store chunk embeddings (JSON) and run cosine similarity search.

Using JSON + in-Python cosine similarity keeps the app portable — no pgvector
extension required, so it runs on a bare local Postgres or Neon alike.
"""
import json
import logging
from sqlalchemy import select
from app.models import Chunk
from app.llm_client import embed_text

logger = logging.getLogger("vectorstore")


def _cosine(a, b):
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def store_embeddings(db, paper_id, chunks_with_pages: list, batch_size: int = 20):
    """chunks_with_pages: list of {"text": str, "page": int, "order": int}."""
    for i in range(0, len(chunks_with_pages), batch_size):
        batch = chunks_with_pages[i : i + batch_size]
        texts = [c["text"] for c in batch]
        try:
            embeddings = [embed_text(t) for t in texts]
        except Exception as e:  # noqa: BLE001
            logger.error("Embedding batch failed: %s", e)
            raise
        for c, emb in zip(batch, embeddings):
            db.add(
                Chunk(
                    paper_id=paper_id,
                    chunk_text=c["text"],
                    page_number=c.get("page"),
                    embedding=json.dumps(emb),
                    chunk_order=c.get("order"),
                )
            )
    db.commit()


def search_similar(db, paper_id, query: str, top_k: int = 5):
    """Return top-k chunks (text, page) for a query within one paper."""
    query_emb = embed_text(query)
    rows = (
        db.execute(
            select(Chunk.chunk_text, Chunk.page_number, Chunk.embedding)
            .where(Chunk.paper_id == paper_id)
        )
        .fetchall()
    )
    scored = []
    for chunk_text, page_number, emb_json in rows:
        try:
            emb = json.loads(emb_json) if emb_json else None
        except (TypeError, json.JSONDecodeError):
            emb = None
        score = _cosine(query_emb, emb) if emb else 0.0
        scored.append({"text": chunk_text, "page": page_number, "score": score})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return [{"text": s["text"], "page": s["page"]} for s in scored[:top_k]]


def _centroid(vecs):
    if not vecs:
        return None
    dim = len(vecs[0])
    return [sum(v[i] for v in vecs) / len(vecs) for i in range(dim)]


def similar_papers(db, paper_id, top_k: int = 5):
    """Rank other papers by embedding similarity to the target paper's centroid."""
    from app.models import Paper
    from collections import defaultdict

    rows = db.execute(select(Chunk.paper_id, Chunk.embedding)).fetchall()
    groups = defaultdict(list)
    for pid, emb_json in rows:
        try:
            emb = json.loads(emb_json)
        except (TypeError, json.JSONDecodeError):
            emb = None
        if emb:
            groups[pid].append(emb)

    if paper_id not in groups:
        return []
    target = _centroid(groups[paper_id])
    scored = []
    for pid, vecs in groups.items():
        if str(pid) == str(paper_id):
            continue
        c = _centroid(vecs)
        if c:
            scored.append((pid, _cosine(target, c)))
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_k]
    if not top:
        return []
    ids = [pid for pid, _ in top]
    papers = {p.id: p for p in db.query(Paper).filter(Paper.id.in_(ids)).all()}
    return [(papers[pid], score) for pid, score in top if pid in papers]

