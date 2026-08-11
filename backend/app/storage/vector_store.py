import os
import time
import asyncpg
import google.generativeai as genai
from .database import get_pool as get_db_pool

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 3072

VECTOR_SCHEMA = """
CREATE TABLE IF NOT EXISTS paper_chunks (
    id          TEXT PRIMARY KEY,
    paper_id    TEXT NOT NULL,
    page        INTEGER,
    chunk_id    INTEGER,
    text        TEXT NOT NULL,
    embedding   vector({dim}),
    created_at  DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper ON paper_chunks(paper_id);
""".format(dim=EMBEDDING_DIM)


async def get_pool():
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(VECTOR_SCHEMA)
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        except Exception:
            pass
    return pool


def _embed(text: str) -> list[float]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    genai.configure(api_key=api_key)
    result = genai.embed_content(model=EMBEDDING_MODEL, content=text)
    return result["embedding"]


def _embed_safe(text: str) -> list[float] | None:
    try:
        return _embed(text)
    except Exception:
        return None


def chunk_text(pages: list[dict], max_chars: int = 1000, overlap: int = 100) -> list[dict]:
    chunks = []
    chunk_id = 0
    for page in pages:
        text = page["text"]
        page_num = page["page"]
        start = 0
        while start < len(text):
            end = start + max_chars
            chunk_text_str = text[start:end]
            chunks.append({
                "chunk_id": chunk_id,
                "page": page_num,
                "text": chunk_text_str,
            })
            chunk_id += 1
            start += max_chars - overlap
    return chunks


async def embed_and_store(paper_id: str, chunks: list[dict]):
    pool = await get_pool()
    now = time.time()

    ids = [f"{paper_id}_chunk_{c['chunk_id']}" for c in chunks]
    documents = [c["text"] for c in chunks]

    embeddings = [None] * len(documents)
    for i, doc in enumerate(documents):
        embeddings[i] = await _aembed(doc)

    records = []
    for i in range(len(documents)):
        if embeddings[i] is not None:
            records.append((ids[i], paper_id, chunks[i]["page"], chunks[i]["chunk_id"],
                            documents[i], "[" + ",".join(str(x) for x in embeddings[i]) + "]", now))

    if records:
        async with pool.acquire() as conn:
            await conn.executemany(
                """INSERT INTO paper_chunks (id, paper_id, page, chunk_id, text, embedding, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6::vector,$7)
                   ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, embedding=EXCLUDED.embedding""",
                records,
            )


async def _aembed(text: str) -> list[float] | None:
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _embed_safe, text)


async def purge_expired(max_age_days: int = 30) -> int:
    pool = await get_pool()
    cutoff = time.time() - (max_age_days * 86400)
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM paper_chunks WHERE created_at < $1", cutoff)
    return int(result.split()[-1]) if result else 0


async def get_all_documents() -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, paper_id, page, chunk_id, text, created_at FROM paper_chunks ORDER BY created_at DESC")
    return [{
        "id": r["id"],
        "text": r["text"][:200] + "..." if len(r["text"]) > 200 else r["text"],
        "paper_id": r["paper_id"],
        "page": r["page"],
        "chunk_id": r["chunk_id"],
        "created_at": r["created_at"],
        "has_embedding": True,
    } for r in rows]


async def similarity_search(query: str, paper_id: str | None = None, top_k: int = 5) -> list[dict]:
    import asyncio
    loop = asyncio.get_event_loop()
    query_embedding = await loop.run_in_executor(None, _embed_safe, query)
    if query_embedding is None:
        return []

    emb_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    pool = await get_pool()
    async with pool.acquire() as conn:
        if paper_id:
            rows = await conn.fetch(
                """SELECT id, paper_id, page, text,
                   1 - (embedding <=> $1::vector) AS score
                   FROM paper_chunks
                   WHERE paper_id = $2
                   ORDER BY embedding <=> $1::vector
                   LIMIT $3""",
                emb_str, paper_id, top_k,
            )
        else:
            rows = await conn.fetch(
                """SELECT id, paper_id, page, text,
                   1 - (embedding <=> $1::vector) AS score
                   FROM paper_chunks
                   ORDER BY embedding <=> $1::vector
                   LIMIT $2""",
                emb_str, top_k,
            )
    return [{"text": r["text"], "paper_id": r["paper_id"], "page": r["page"], "score": float(r["score"])} for r in rows]
