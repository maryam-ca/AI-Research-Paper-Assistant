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
- "similarities": a list of strings, each describing a key similarity across papers (what they share in methodology, findings, or approach)
- "differences": a list of objects, each with "aspect" (what is being compared), "papers" (an object mapping paper_id to that paper's stance/value for this aspect), and optionally "significance" (why this difference matters)

Do not add information beyond what is present in the excerpts. Reference \
papers by their IDs.

{papers_text}
"""


async def _gather_chunks(paper_ids: list[str], chunks_per_paper: int = 10) -> dict[str, str]:
    papers = {}
    broad_query = "methodology results findings experiments"
    for pid in paper_ids:
        matches = await similarity_search(broad_query, paper_id=pid, top_k=chunks_per_paper)
        papers[pid] = "\n\n".join(
            f"[page {m['page']}] {m['text']}" for m in matches
        )
    return papers


async def compare_papers(paper_ids: list[str], chunks_per_paper: int = 10) -> dict:
    if len(paper_ids) < 2:
        raise ValueError("At least two paper IDs are required for comparison")

    papers = await _gather_chunks(paper_ids, chunks_per_paper)

    papers_text = ""
    for pid in paper_ids:
        papers_text += f"=== Paper {pid} ===\n{papers[pid]}\n\n"

    raw = await gemini_generate_json(
        COMPARE_PROMPT.format(n=len(paper_ids), papers_text=papers_text)
    )
    return json.loads(raw)


async def compare_methodologies(paper_ids: list[str]) -> dict:
    from ..storage import paper_store
    from ..llm_client import gemini_generate

    if len(paper_ids) < 2:
        raise ValueError("At least two paper IDs are required for comparison")

    papers = []
    for pid in paper_ids:
        p = await paper_store.get_paper(pid)
        if p:
            papers.append(p)

    if len(papers) < 2:
        return {"error": "Need at least 2 papers with content to compare"}

    METHODOLOGY_PROMPT = """Compare the methodologies of the following {n} research papers. Provide a detailed comparison covering:

1. **Research Design** - Experimental, observational, theoretical, simulation, etc.
2. **Data Sources** - Datasets, participants, materials, instruments used
3. **Methods/Techniques** - Specific algorithms, statistical methods, analytical frameworks
4. **Validation Approach** - How results were validated (cross-validation, baselines, user studies, etc.)
5. **Strengths & Weaknesses** of each methodology
6. **Overall Assessment** - Which approach seems most rigorous/appropriate for the research question

Format as a structured comparison with clear sections. Reference papers by their titles.

Papers:
"""
    papers_text = ""
    for p in papers:
        title = p.get("filename", "Untitled")
        methodology = p.get("key_elements", {}).get("methodology", "") or p.get("detailed_summary", "")[:2000]
        papers_text += f"\n--- {title} (ID: {p['id']}) ---\n{methodology}\n"

    prompt = METHODOLOGY_PROMPT.format(n=len(papers)) + papers_text

    try:
        comparison = await gemini_generate(prompt)
        return {"methodology_comparison": comparison}
    except Exception as e:
        return {"error": f"Methodology comparison failed: {e}"}
