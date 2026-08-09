import re
from concurrent.futures import ThreadPoolExecutor
from ..storage.vector_store import similarity_search, _embed, _get_collection


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if len(s.strip()) > 20]


def check_attribution(summary: str, paper_id: str, threshold: float = 0.35) -> dict:
    sentences = _split_sentences(summary)
    if not sentences:
        return {"total_sentences": 0, "supported": 0, "flagged": 0, "flagged_details": []}

    collection = _get_collection()

    with ThreadPoolExecutor(max_workers=min(10, len(sentences))) as executor:
        query_embeddings = list(executor.map(_embed, sentences))

    results = collection.query(
        query_embeddings=query_embeddings,
        n_results=1,
        where={"paper_id": paper_id},
        include=["distances"],
    )

    flagged = []
    supported = []
    for i, sent in enumerate(sentences):
        dist = results["distances"][0][i] if results["distances"] and results["distances"][0] else 1.0
        score = 1 - dist
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


def flag_summaries(
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
            results[name] = check_attribution(text, paper_id)
    return results
