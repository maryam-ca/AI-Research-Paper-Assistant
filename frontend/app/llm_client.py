"""Single shared Gemini client with a model fallback chain.

Uses the modern Google Gen AI SDK.
"""

import os
import logging

from google import genai
from google.genai import types

logger = logging.getLogger("llm_client")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None
    logger.warning(
        "GEMINI_API_KEY not set; LLM calls will fail until configured."
    )


# Ordered by speed/availability. First available wins.
GENERATION_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
]

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 3072


def _is_quota_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "quota" in msg or "429" in msg or "rate" in msg


def generate_with_fallback(
    prompt: str,
    max_tokens: int = 2000,
    temperature: float = 0.7,
):
    """Try each generation model in order; return (text, model_name)."""

    if client is None:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured."
        )

    last_error = None

    for model_name in GENERATION_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=max_tokens,
                    temperature=temperature,
                ),
            )

            return response.text, model_name

        except Exception as e:
            if _is_quota_error(e):
                logger.warning(
                    "Model %s quota/rate limited, trying next.",
                    model_name,
                )
                last_error = e
                continue

            logger.error(
                "Model %s failed: %s",
                model_name,
                e,
            )
            raise

    raise RuntimeError(
        f"All generation models exhausted. Last error: {last_error}"
    )


def embed_text(text: str) -> list[float]:
    """Generate a 3072-dimensional embedding."""

    if client is None:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured."
        )

    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=EMBEDDING_DIM,
        ),
    )

    return result.embeddings[0].values


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed; falls back to sequential embedding."""

    return [embed_text(text) for text in texts]