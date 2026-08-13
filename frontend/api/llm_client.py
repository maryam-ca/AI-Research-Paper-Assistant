"""Single shared Gemini client with a model fallback chain.

Iteration 5 lesson: hardcoding a single model fails when quota is exhausted.
We try each generation model in order and use the first that succeeds.
"""
import os
import logging
import google.generativeai as genai

logger = logging.getLogger("llm_client")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY not set; LLM calls will fail until configured.")

# Ordered by speed/availability. First available wins.
GENERATION_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
]

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 3072


def _is_quota_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "quota" in msg or "429" in msg or "rate" in msg


def generate_with_fallback(prompt: str, max_tokens: int = 2000, temperature: float = 0.7):
    """Try each generation model in order; return (text, model_name)."""
    last_error = None
    for model_name in GENERATION_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=temperature,
                ),
            )
            return response.text, model_name
        except Exception as e:  # noqa: BLE001
            if _is_quota_error(e):
                logger.warning("Model %s quota/rate limited, trying next.", model_name)
                last_error = e
                continue
            logger.error("Model %s failed: %s", model_name, e)
            raise
    raise RuntimeError(f"All generation models exhausted. Last error: {last_error}")


def embed_text(text: str) -> list[float]:
    """Generate a 3072-dim embedding for the given text."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        output_dimensionality=EMBEDDING_DIM,
    )
    return result["embedding"]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed; falls back to sequential on any batch error."""
    return [embed_text(t) for t in texts]
