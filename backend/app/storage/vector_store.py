import os
import chromadb
import google.generativeai as genai

EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIM = 768

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        _client = chromadb.PersistentClient()
        _collection = _client.get_or_create_collection(
            name="papers",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _embed(text: str) -> list[float]:
    result = genai.embed_content(model=EMBEDDING_MODEL, content=text)
    return result["embedding"]


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


def embed_and_store(paper_id: str, chunks: list[dict]):
    import time
    collection = _get_collection()
    now = time.time()
    ids = [f"{paper_id}_chunk_{c['chunk_id']}" for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [
        {"paper_id": paper_id, "page": c["page"], "chunk_id": c["chunk_id"], "created_at": now}
        for c in chunks
    ]

    embeddings = [_embed(doc) for doc in documents]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )


def purge_expired(max_age_days: int = 30) -> int:
    collection = _get_collection()
    import time
    cutoff = time.time() - (max_age_days * 86400)
    all_data = collection.get(include=["metadatas"])
    expired_ids = []
    for doc_id, meta in zip(all_data["ids"], all_data["metadatas"]):
        ts = meta.get("created_at", 0)
        if ts < cutoff:
            expired_ids.append(doc_id)
    if expired_ids:
        collection.delete(ids=expired_ids)
    return len(expired_ids)


def similarity_search(query: str, paper_id: str | None = None, top_k: int = 5) -> list[dict]:
    collection = _get_collection()
    query_embedding = _embed(query)

    where = {"paper_id": paper_id} if paper_id else None

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    matches = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        matches.append({
            "text": doc,
            "paper_id": meta["paper_id"],
            "page": meta["page"],
            "score": 1 - dist,
        })
    return matches
