"""Key-element extraction. Returns structured JSON with escaped placeholders."""
from llm_client import generate_with_fallback
from utils import fill, extract_json

ELEMENTS_TEMPLATE = """Extract the following structured elements from the research
paper. Respond with ONLY a JSON object (no markdown) using exactly these keys:
problem, methodology, results, limitations, contributions, future_work,
keywords, readability_score, complexity_level, rigor_score, bias_risk,
reproducibility_score, quality_flags.
- Each of the six element values should be a concise paragraph (or empty string if not stated).
- keywords: a JSON array of 5-10 concise key terms/topics from the paper.
- readability_score: an integer 0-100 estimating how readable the prose is (higher = easier).
- complexity_level: one of "easy", "medium", or "hard" for the conceptual difficulty.
- rigor_score: an integer 0-100 estimating methodology/statistical rigor.
- bias_risk: one of "low", "medium", or "high" for risk of bias / conflicts of interest.
- reproducibility_score: an integer 0-100 estimating reproducibility (code/data available, methods detailed, preregistration).
- quality_flags: a JSON array of 3-6 short strings flagging issues (e.g. "small sample size", "no conflict-of-interest statement", "methods underspecified").

PAPER:
{{paper_text}}

JSON:"""

FIELDS = ["problem", "methodology", "results", "limitations", "contributions", "future_work"]


def extract_key_elements(paper_text: str) -> dict:
    prompt = fill(ELEMENTS_TEMPLATE, paper_text=paper_text[:30000])
    text, _ = generate_with_fallback(prompt, max_tokens=2000)
    data = extract_json(text)
    if not isinstance(data, dict):
        data = {}

    result = {}
    for field in FIELDS:
        val = data.get(field, "")
        result[field] = val if isinstance(val, str) else str(val)

    # Keywords
    keywords = data.get("keywords") or []
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]
    result["keywords"] = [str(k) for k in keywords if str(k).strip()][:10]

    # Readability score (0-100)
    try:
        result["readability_score"] = int(data.get("readability_score") or 0)
    except (TypeError, ValueError):
        result["readability_score"] = None

    # Complexity level
    level = str(data.get("complexity_level") or "medium").strip().lower()
    result["complexity_level"] = level if level in ("easy", "medium", "hard") else "medium"

    # Rigor score (0-100)
    try:
        result["rigor_score"] = int(data.get("rigor_score") or 0)
    except (TypeError, ValueError):
        result["rigor_score"] = None

    # Bias risk
    bias = str(data.get("bias_risk") or "medium").strip().lower()
    result["bias_risk"] = bias if bias in ("low", "medium", "high") else "medium"

    # Reproducibility score (0-100)
    try:
        result["reproducibility_score"] = int(data.get("reproducibility_score") or 0)
    except (TypeError, ValueError):
        result["reproducibility_score"] = None

    # Quality flags
    flags = data.get("quality_flags") or []
    if isinstance(flags, str):
        flags = [f.strip() for f in flags.split(",") if f.strip()]
    result["quality_flags"] = [str(f) for f in flags if str(f).strip()][:6]

    return result
