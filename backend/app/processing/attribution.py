import re
import asyncio
from ..storage.vector_store import similarity_search, _aembed, get_pool


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if len(s.strip()) > 20]


async def check_attribution(summary: str, paper_id: str, threshold: float = 0.35) -> dict:
    sentences = _split_sentences(summary)
    if not sentences:
        return {"total_sentences": 0, "supported": 0, "flagged": 0, "flagged_details": []}

    query_embeddings = []
    for sent in sentences:
        emb = await _aembed(sent)
        query_embeddings.append(emb)

    valid_embeddings = [e for e in query_embeddings if e is not None]
    if not valid_embeddings:
        return {"total_sentences": len(sentences), "supported": 0, "flagged": len(sentences), "flagged_details": [{"sentence": s, "reason": "embedding_failed"} for s in sentences]}

    pool = await get_pool()
    async with pool.acquire() as conn:
        flagged = []
        supported = []
        for i, sent in enumerate(sentences):
            if query_embeddings[i] is None:
                flagged.append({"sentence": sent, "reason": "embedding_failed"})
                continue
            emb_str = "[" + ",".join(str(x) for x in query_embeddings[i]) + "]"
            rows = await conn.fetch(
                """SELECT 1 - (embedding <=> $1::vector) AS score
                   FROM paper_chunks
                   WHERE paper_id = $2
                   ORDER BY embedding <=> $1::vector
                   LIMIT 1""",
                emb_str, paper_id,
            )
            score = float(rows[0]["score"]) if rows else 0.0
            if score < threshold:
                flagged.append({"sentence": sent, "reason": "no_matching_chunk"})
            else:
                supported.append({"sentence": sent, "score": score})

    return {
        "total_sentences": len(sentences),
        "supported": len(supported),
        "flagged": len(flagged),
        "flagged_details": flagged,
    }


async def flag_summaries(
    executive_summary: str | None,
    detailed_summary: str | None,
    key_findings: str | None,
    paper_id: str,
) -> dict:
    results = {}
    for name, text in [
        ("executive_summary", executive_summary),
        ("detailed_summary", detailed_summary),
        ("key_findings", key_findings),
    ]:
        if text:
            results[name] = await check_attribution(text, paper_id)
    return results
