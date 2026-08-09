import os
import time
import hashlib
import google.generativeai as genai


# ---------------------------------------------------------------------------
# Simple in-memory LRU-ish cache for Gemini responses.
# Key: SHA-256(prompt + model + generation_config)
# Value: (response_text, timestamp)
# Max 500 entries; entries older than 1 hour are evicted on access.
# ---------------------------------------------------------------------------
_CACHE: dict[str, tuple[str, float]] = {}
_CACHE_MAX = 500
_CACHE_TTL = 3600  # seconds


def _cache_key(prompt: str, model_name: str, generation_config: dict | None) -> str:
    raw = prompt + "|" + model_name + "|" + str(sorted((generation_config or {}).items()))
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_get(key: str) -> str | None:
    if key in _CACHE:
        text, ts = _CACHE[key]
        if time.time() - ts < _CACHE_TTL:
            return text
        del _CACHE[key]
    return None


def _cache_set(key: str, value: str):
    if len(_CACHE) >= _CACHE_MAX:
        # evict oldest 20 %
        oldest = sorted(_CACHE, key=lambda k: _CACHE[k][1])[: _CACHE_MAX // 5]
        for k in oldest:
            del _CACHE[k]
    _CACHE[key] = (value, time.time())


# ---------------------------------------------------------------------------

def get_gemini_model(model_name: str = "gemini-2.5-flash"):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)


# Ordered fallback list: if the primary model is quota-limited or unavailable,
# try the next one. Ensures the app keeps working across free-tier quotas.
MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
]


def gemini_generate(prompt: str, model_name: str = "gemini-2.5-flash",
                    max_retries: int = 2, backoff: float = 2.0,
                    generation_config: dict | None = None) -> str:
    key = _cache_key(prompt, model_name, generation_config)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    last_exc = None
    models = [model_name] + [m for m in MODEL_FALLBACKS if m != model_name]
    for model_name in models:
        try:
            result = _generate_once(
                prompt, model_name, max_retries, backoff, generation_config
            )
            _cache_set(key, result)
            return result
        except Exception as e:
            last_exc = e
            msg = str(e).lower()
            # Only fall through to another model on quota/availability errors.
            if "rate" in msg or "429" in msg or "quota" in msg or "not found" in msg or "no longer available" in msg:
                continue
            raise
    raise last_exc


def _generate_once(prompt, model_name, max_retries, backoff, generation_config):
    model = get_gemini_model(model_name)
    last_exc = None
    for attempt in range(max_retries):
        try:
            kwargs = {}
            if generation_config:
                kwargs["generation_config"] = generation_config
            response = model.generate_content(prompt, **kwargs)
            return response.text
        except Exception as e:
            last_exc = e
            msg = str(e).lower()
            if "rate" in msg or "429" in msg or "quota" in msg:
                wait = backoff * (2 ** attempt)
                time.sleep(min(wait, 60))
                continue
            if attempt < max_retries - 1:
                time.sleep(backoff * attempt)
                continue
    raise last_exc


def gemini_generate_json(prompt: str, model_name: str = "gemini-2.5-flash",
                         max_retries: int = 2) -> str:
    return gemini_generate(
        prompt,
        model_name=model_name,
        max_retries=max_retries,
        generation_config={"response_mime_type": "application/json"},
    )
