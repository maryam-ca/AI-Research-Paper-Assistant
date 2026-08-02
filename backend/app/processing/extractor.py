import json
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
{paper_text}
""".format(keys=", ".join(_REQUIRED_KEYS), paper_text="{paper_text}")


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
