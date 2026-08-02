import re
from ..storage.vector_store import similarity_search


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if len(s.strip()) > 20]


def check_attribution(summary: str, paper_id: str, threshold: float = 0.35) -> dict:
    sentences = _split_sentences(summary)
    flagged = []
    supported = []
    for sent in sentences:
        matches = similarity_search(sent, paper_id=paper_id, top_k=1)
        if not matches or matches[0]["score"] < threshold:
            flagged.append({"sentence": sent, "reason": "no_matching_chunk"})
        else:
            supported.append({"sentence": sent, "score": matches[0]["score"]})
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
