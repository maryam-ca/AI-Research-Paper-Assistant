"""Summarization module. Prompt templates use {{paper_text}} placeholders
and are filled via utils.fill() (NOT str.format) so literal JSON braces in
other prompts are never mangled.
"""
from llm_client import generate_with_fallback
from utils import fill

EXEC_TEMPLATE = """You are a research assistant. Read the following paper excerpt and
write a concise executive summary (2-3 paragraphs, plain language) that captures
the core problem, approach, and outcome.

PAPER:
{{paper_text}}

EXECUTIVE SUMMARY:"""

DETAILED_TEMPLATE = """You are a research assistant. Produce a structured, detailed
summary of the paper with these sections:
# Background
# Objective
# Methods
# Results
# Discussion
# Conclusion

PAPER:
{{paper_text}}

DETAILED SUMMARY:"""

FINDINGS_TEMPLATE = """List the 5-8 most important findings of this paper as a
JSON array of short strings. Respond ONLY with a JSON array, e.g.
["Finding one", "Finding two"].

PAPER:
{{paper_text}}

KEY FINDINGS (JSON array only):"""


def generate_executive_summary(paper_text: str) -> str:
    prompt = fill(EXEC_TEMPLATE, paper_text=paper_text[:30000])
    text, _ = generate_with_fallback(prompt, max_tokens=1200)
    return text.strip()


def generate_detailed_summary(paper_text: str) -> str:
    prompt = fill(DETAILED_TEMPLATE, paper_text=paper_text[:30000])
    text, _ = generate_with_fallback(prompt, max_tokens=2500)
    return text.strip()


def extract_key_findings(paper_text: str) -> list:
    import json
    import re
    prompt = fill(FINDINGS_TEMPLATE, paper_text=paper_text[:30000])
    text, _ = generate_with_fallback(prompt, max_tokens=1000)
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [str(x) for x in data]
    except Exception:  # noqa: BLE001
        pass
    # fallback: split by lines, drop fence artifacts
    return [
        l.strip("- ").strip()
        for l in text.splitlines()
        if l.strip() and not l.strip().startswith("```")
    ]
