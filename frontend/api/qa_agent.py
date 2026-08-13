"""RAG Q&A agent: retrieve relevant chunks and answer with page citations."""
from llm_client import generate_with_fallback
from vectorstore import search_similar
from utils import fill

QA_TEMPLATE = """You are a research assistant answering questions about a specific
paper. Use ONLY the excerpts below. Cite the page numbers that support your
answer. If the answer is not in the excerpts, say so.

EXCERPTS:
{{context}}

QUESTION: {{question}}

ANSWER (include cited page numbers like [p.3, p.5]):"""


SUGGEST_TEMPLATE = """You are helping a researcher explore a paper. Given the question
below (or the paper generally if none), suggest 5 concise follow-up questions that would
deepen understanding of the paper's contributions, limitations, and methodology.
Respond with ONLY a JSON array of short strings.

PAPER EXCERPTS:
{{context}}

PREVIOUS QUESTION: {{previous}}

JSON ARRAY:"""


def answer_question(db, paper_id, question: str, top_k: int = 5, suggest: bool = False, previous: str = None):
    chunks = search_similar(db, paper_id, question or previous or "", top_k=top_k)
    if not chunks:
        raise ValueError(
            "No embeddings found for this paper. Run analysis (/analyze) first."
        )
    context = "\n\n".join(
        f"[p.{c['page']}] {c['text']}" for c in chunks if c["page"]
    )

    if suggest:
        prompt = fill(SUGGEST_TEMPLATE, context=context, previous=previous or "None")
        text, _ = generate_with_fallback(prompt, max_tokens=600)
        import json
        import re
        cleaned = text.strip()
        fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
        if fence:
            cleaned = fence.group(1).strip()
        try:
            data = json.loads(cleaned)
            if isinstance(data, list):
                return [str(x) for x in data if str(x).strip()][:5]
        except Exception:  # noqa: BLE001
            pass
        return [l.strip("- ").strip() for l in text.splitlines() if l.strip() and not l.strip().startswith("```")][:5]

    prompt = fill(QA_TEMPLATE, context=context, question=question)
    answer, _ = generate_with_fallback(prompt, max_tokens=1200)

    cited_pages = sorted({c["page"] for c in chunks if c["page"]})
    return {"answer": answer.strip(), "cited_pages": cited_pages}
