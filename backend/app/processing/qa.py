from backend.app.llm_client import gemini_generate
from backend.app.storage.vector_store import similarity_search

QA_PROMPT = """\
You are a research assistant. Answer the user's question using ONLY the \
context provided below. Cite page numbers inline (e.g., [page 3]) wherever \
you reference a specific page. If the context does not contain enough \
information to answer, say so explicitly. Do not add facts from outside \
the provided context.

Context:
{context}

Question: {question}
"""


def answer_question(paper_id: str, question: str, top_k: int = 5) -> dict:
    chunks = similarity_search(question, paper_id=paper_id, top_k=top_k)
    if not chunks:
        return {"answer": "No relevant context found for this paper.", "sources": []}

    context = "\n\n".join(
        f"[page {c['page']}] {c['text']}" for c in chunks
    )

    answer = gemini_generate(QA_PROMPT.format(context=context, question=question))

    pages = sorted({c["page"] for c in chunks})
    return {"answer": answer, "sources": pages}
