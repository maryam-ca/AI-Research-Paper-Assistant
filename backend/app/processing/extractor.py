import json
import re
from ..llm_client import gemini_generate_json

_REQUIRED_KEYS = [
    "problem_statement",
    "methodology",
    "results",
    "contributions",
    "limitations",
    "future_work",
]

_EXTRACTION_PROMPT = """\
You are a research assistant. Extract the following key elements from the \
research paper provided. Return ONLY a valid JSON object with these keys: \
{keys}. Each value should be a concise string or list of strings. Stay \
strictly grounded in the provided text. Do not add outside facts.

Paper text:
{{paper_text}}
""".format(keys=", ".join(_REQUIRED_KEYS))

FIGURES_TABLES_PROMPT = """\
You are a research assistant. Analyze the following research paper text and extract all figures and tables mentioned.
Look for references like "Figure 1", "Fig. 2", "Table 1", "Table 2", etc., and their captions/descriptions.

Return ONLY a valid JSON object with two keys: "figures" and "tables".
Each should be an array of objects with:
- "number": the figure/table number (e.g., "1", "2", "3a")
- "type": "figure" or "table"
- "caption": the caption text if found, or a brief description
- "page": the page number if mentioned, otherwise null
- "context": a brief sentence about what the figure/table shows

Paper text:
{paper_text}
"""


def _parse_elements(raw: str) -> dict:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Response is not a JSON object")
    for key in _REQUIRED_KEYS:
        if key not in data:
            raise ValueError(f"Missing required key: {key}")
    return {k: data[k] for k in _REQUIRED_KEYS}


def extract_key_elements(paper_text: str) -> dict:
    prompt = _EXTRACTION_PROMPT.format(paper_text=paper_text)
    raw = gemini_generate_json(prompt)
    return _parse_elements(raw)


def extract_figures_tables(paper_text: str) -> dict:
    prompt = FIGURES_TABLES_PROMPT.format(paper_text=paper_text)
    raw = gemini_generate_json(prompt)
    try:
        data = json.loads(raw)
        figures = data.get("figures", [])
        tables = data.get("tables", [])
        return {"figures": figures, "tables": tables}
    except Exception:
        return {"figures": [], "tables": []}
