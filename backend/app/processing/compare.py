import json
from ..llm_client import gemini_generate_json
from ..storage.vector_store import similarity_search

COMPARE_PROMPT = """\
You are a research assistant. Below are extracted excerpts from {n} \
research papers. Produce a structured comparison of their methodologies \
and findings. Return a JSON object with these keys:

- "overview": a brief sentence per paper summarizing its focus
- "methodologies": a table-like comparison of methods used
- "findings": a table-like comparison of key results
- "strengths_weaknesses": per-paper strengths and weaknesses
- "gaps": unaddressed gaps or opportunities across the papers

Do not add information beyond what is present in the excerpts. Reference \
papers by their IDs.

{papers_text}
"""


def _gather_chunks(paper_ids: list[str], chunks_per_paper: int = 10) -> dict[str, str]:
    papers = {}
    broad_query = "methodology results findings experiments"
    for pid in paper_ids:
        matches = similarity_search(broad_query, paper_id=pid, top_k=chunks_per_paper)
        papers[pid] = "\n\n".join(
            f"[page {m['page']}] {m['text']}" for m in matches
        )
    return papers


def compare_papers(paper_ids: list[str], chunks_per_paper: int = 10) -> dict:
    if len(paper_ids) < 2:
        raise ValueError("At least two paper IDs are required for comparison")

    papers = _gather_chunks(paper_ids, chunks_per_paper)

    papers_text = ""
    for pid in paper_ids:
        papers_text += f"=== Paper {pid} ===\n{papers[pid]}\n\n"

    raw = gemini_generate_json(
        COMPARE_PROMPT.format(n=len(paper_ids), papers_text=papers_text)
    )
    return json.loads(raw)
