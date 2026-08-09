from ..llm_client import gemini_generate
from ..storage.vector_store import similarity_search
from ..storage import paper_store
import json as _json

QA_PROMPT = """\
You are a research assistant. Answer the user's question using ONLY the \
context provided below and the conversation history. Cite page numbers \
inline (e.g., [page 3]) whenever you reference a specific page. If the \
context does not contain enough information to answer, say so explicitly. \
Do not add facts from outside the provided context. If the user asks a \
follow-up question, use the conversation history to understand what they \
are referring to.

Context:
{context}

{history_block}
Question: {question}
"""

FLASHCARD_PROMPT = """\
You are a research assistant creating flashcards for self-testing based on a research paper.
Given the key findings and context from the paper, generate 10-15 flashcards in Q&A format.

Each flashcard should have:
- "question": A clear, specific question testing understanding of a key concept
- "answer": A concise answer (1-3 sentences) based on the paper content
- "difficulty": "easy" | "medium" | "hard"
- "page_ref": The page number where this concept is discussed (if available)

Focus on: methodology, key results, contributions, limitations, and technical details.
Make questions that would be useful for someone studying this paper.

Context from paper:
{context}

Return ONLY a JSON array of flashcard objects. Example:
[
  {"question": "What is the main contribution of this paper?", "answer": "The paper proposes a novel attention mechanism...", "difficulty": "easy", "page_ref": 1},
  {"question": "What dataset was used for evaluation?", "answer": "The authors used the ImageNet dataset...", "difficulty": "medium", "page_ref": 4}
]
"""

def answer_question(
    paper_id: str, question: str, history: list[dict] | None = None, top_k: int = 5
) -> dict:
    chunks = similarity_search(question, paper_id=paper_id, top_k=top_k)
    if not chunks:
        return {"answer": "No relevant context found for this paper.", "sources": []}

    context = "\n\n".join(
        f"[page {c['page']}] {c['text']}" for c in chunks
    )

    history_block = ""
    if history:
        lines = []
        for msg in history[-6:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            lines.append(f"{role}: {msg.get('text', '')}")
        history_block = "Conversation History:\n" + "\n".join(lines) + "\n\n"

    answer = gemini_generate(
        QA_PROMPT.format(context=context, history_block=history_block, question=question)
    )

    pages = sorted({c["page"] for c in chunks})
    return {"answer": answer, "sources": pages}


def generate_flashcards(paper_id: str, key_findings: str = "") -> list[dict]:
    chunks = similarity_search("key findings methodology results contributions", paper_id=paper_id, top_k=20)
    if not chunks and not key_findings:
        return []

    context_parts = []
    if key_findings:
        context_parts.append(f"Key Findings:\n{key_findings}")
    if chunks:
        context_parts.append("Paper Content:\n" + "\n\n".join(
            f"[page {c['page']}] {c['text']}" for c in chunks
        ))

    context = "\n\n".join(context_parts)
    if not context.strip():
        return []

    raw = gemini_generate(
        FLASHCARD_PROMPT.format(context=context),
        generation_config={"response_mime_type": "application/json"}
    )

    try:
        flashcards = _json.loads(raw)
        if isinstance(flashcards, list):
            return flashcards
    except Exception:
        pass
    return []


def answer_question_multi(paper_ids: list[str], question: str, history: list[dict] | None = None, top_k_per_paper: int = 3) -> dict:
    all_chunks = []
    for pid in paper_ids:
        chunks = similarity_search(question, paper_id=pid, top_k=top_k_per_paper)
        for c in chunks:
            c["paper_id"] = pid
            all_chunks.append(c)

    if not all_chunks:
        return {"answer": "No relevant context found across selected papers.", "sources": []}

    all_chunks.sort(key=lambda x: x.get("score", 0), reverse=True)
    top_chunks = all_chunks[:top_k_per_paper * len(paper_ids)]

    context_parts = []
    for c in top_chunks:
        pid = c["paper_id"]
        paper = paper_store.get_paper(pid)
        filename = paper.get("filename", pid) if paper else pid
        context_parts.append(f"[Paper: {filename}, page {c['page']}] {c['text']}")

    context = "\n\n".join(context_parts)

    history_block = ""
    if history:
        lines = []
        for msg in history[-6:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            lines.append(f"{role}: {msg.get('text', '')}")
        history_block = "Conversation History:\n" + "\n".join(lines) + "\n\n"

    MULTI_QA_PROMPT = """\
You are a research assistant. Answer the user's question using ONLY the context provided below from multiple papers. Cite the paper name and page number inline (e.g., [Paper: filename, page 3]) whenever you reference a specific source. If the context does not contain enough information to answer, say so explicitly. Do not add facts from outside the provided context.

Context from multiple papers:
{context}

{history_block}
Question: {question}
"""

    answer = gemini_generate(
        MULTI_QA_PROMPT.format(context=context, history_block=history_block, question=question)
    )

    sources = []
    for c in top_chunks:
        pid = c["paper_id"]
        paper = paper_store.get_paper(pid)
        filename = paper.get("filename", pid) if paper else pid
        sources.append({"paper_id": pid, "paper_name": filename, "page": c["page"]})

    return {"answer": answer, "sources": sources}
