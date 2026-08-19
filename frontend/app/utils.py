"""Prompt + JSON helpers shared across LLM modules."""
import re
import json
import logging

logger = logging.getLogger("utils")


def extract_json(text: str):
    """Pull a JSON object out of model output, tolerating code fences/markdown."""
    if text is None:
        return None
    cleaned = text.strip()
    # Remove ```json ... ``` fences
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Fallback: find first {...} block
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as e:
            logger.error("JSON parse failed: %s", e)
    return None


def fill(template: str, **kwargs) -> str:
    """Safe substitution that won't choke on literal braces in prompts."""
    out = template
    for key, value in kwargs.items():
        out = out.replace("{{" + key + "}}", str(value))
    return out
