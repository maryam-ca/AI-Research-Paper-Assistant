"""Tier 2 synthesis generators: literature review, digest, comparison matrix.

All use Gemini via generate_with_fallback and return structured data plus a
ready-to-download Markdown rendering where useful.
"""
import logging
from llm_client import generate_with_fallback
from utils import fill, extract_json

logger = logging.getLogger("synthesis")

LR_SECTIONS = ["introduction", "methodology_review", "findings_synthesis", "research_gaps", "future_work"]
LR_TEMPLATE = """You are writing a literature review that synthesizes the following research papers.
Respond with ONLY a JSON object (no markdown fences) with exactly these keys:
introduction, methodology_review, findings_synthesis, research_gaps, future_work.
Each value is a Markdown-formatted section of 2-4 paragraphs.

Tone: {{tone}}
Length: {{length}}

PAPERS (title + executive summary + key elements):
{{block}}

JSON:"""

DIGEST_TEMPLATE = """Write a short, encouraging research digest for a user based on their
library activity in the past period. Respond with ONLY Markdown (no fences).
Cover:
- Papers added recently (titles)
- Any new topics/keywords emerging
- Reading reminders for papers not yet completed
- A one-line nudge to ask questions about unfinished papers

LIBRARY DATA:
{{block}}

DIGEST (Markdown):"""

MATRIX_TEMPLATE = """Compare the methodology of these research papers. Respond with ONLY a JSON
array (no markdown fences) where each element is an object with keys:
paper_id, title, approach, sample_size, duration, data_source, control_group, outcome_measures.
If a field is not stated, use an empty string.

PAPERS:
{{block}}

JSON ARRAY:"""

MATRIX_FIELDS = ["approach", "sample_size", "duration", "data_source", "control_group", "outcome_measures"]

TRANSLATE_TEMPLATE = """Translate the following research-paper text into {{lang}}.
Preserve any Markdown structure. Respond with ONLY the translated text (no code fences).

TEXT:
{{text}}

TRANSLATION ({{lang}}):"""


def translate_text(text: str, lang: str) -> str:
    if not text:
        return ""
    prompt = fill(TRANSLATE_TEMPLATE, lang=lang, text=text[:8000])
    out, _ = generate_with_fallback(prompt, max_tokens=1500)
    return out.strip()


def _section_md(sections: dict) -> str:
    titles = {
        "introduction": "Introduction",
        "methodology_review": "Methodology Review",
        "findings_synthesis": "Key Findings Synthesis",
        "research_gaps": "Research Gaps",
        "future_work": "Recommendations for Future Work",
    }
    md = ""
    for key in LR_SECTIONS:
        if sections.get(key):
            md += f"## {titles[key]}\n\n{sections[key]}\n\n"
    return md


def generate_literature_review(papers_block: str, tone: str = "academic", length: str = "standard") -> dict:
    prompt = fill(LR_TEMPLATE, tone=tone, length=length, block=papers_block)
    text, _ = generate_with_fallback(prompt, max_tokens=3000)
    data = extract_json(text)
    if not isinstance(data, dict):
        data = {}
    sections = {k: (str(data.get(k, "")) if data.get(k) else "") for k in LR_SECTIONS}
    return {"sections": sections, "markdown": _section_md(sections)}


def generate_digest(block: str) -> str:
    prompt = fill(DIGEST_TEMPLATE, block=block)
    text, _ = generate_with_fallback(prompt, max_tokens=1500)
    return text.strip()


def generate_compare_matrix(papers_block: str) -> list:
    prompt = fill(MATRIX_TEMPLATE, block=papers_block)
    text, _ = generate_with_fallback(prompt, max_tokens=2500)
    data = extract_json(text)
    if not isinstance(data, list):
        return []
    rows = []
    for item in data:
        if not isinstance(item, dict):
            continue
        row = {"paper_id": item.get("paper_id"), "title": item.get("title", "")}
        for f in MATRIX_FIELDS:
            row[f] = item.get(f, "")
        rows.append(row)
    return rows
