import os
import time
import hashlib
import google.generativeai as genai

_redis = None


async def _get_redis():
    global _redis
    if _redis is None:
        try:
            from upstash_redis import AsyncRedis
            _redis = AsyncRedis(
                url=os.environ.get("UPSTASH_REDIS_REST_URL", ""),
                token=os.environ.get("UPSTASH_REDIS_REST_TOKEN", ""),
            )
        except Exception:
            return None
    return _redis


def _cache_key(prompt: str, model_name: str, generation_config: dict | None) -> str:
    raw = prompt + "|" + model_name + "|" + str(sorted((generation_config or {}).items()))
    return "llm_cache:" + hashlib.sha256(raw.encode()).hexdigest()


async def _cache_get(key: str) -> str | None:
    redis = await _get_redis()
    if redis is None:
        return None
    try:
        val = await redis.get(key)
        return val
    except Exception:
        return None


async def _cache_set(key: str, value: str, ttl: int = 3600):
    redis = await _get_redis()
    if redis is None:
        return
    try:
        await redis.setex(key, ttl, value)
    except Exception:
        pass


def get_gemini_model(model_name: str = "gemini-2.5-flash"):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)


MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
]


async def gemini_generate(prompt: str, model_name: str = "gemini-2.5-flash",
                           max_retries: int = 2, backoff: float = 2.0,
                           generation_config: dict | None = None) -> str:
    key = _cache_key(prompt, model_name, generation_config)
    cached = await _cache_get(key)
    if cached is not None:
        return cached

    last_exc = None
    models = [model_name] + [m for m in MODEL_FALLBACKS if m != model_name]
    for model_name in models:
        try:
            result = await _generate_once(
                prompt, model_name, max_retries, backoff, generation_config
            )
            await _cache_set(key, result)
            return result
        except Exception as e:
            last_exc = e
            msg = str(e).lower()
            if "rate" in msg or "429" in msg or "quota" in msg or "not found" in msg or "no longer available" in msg:
                continue
            raise
    raise last_exc


async def _generate_once(prompt, model_name, max_retries, backoff, generation_config):
    import asyncio
    model = get_gemini_model(model_name)
    last_exc = None
    for attempt in range(max_retries):
        try:
            kwargs = {}
            if generation_config:
                kwargs["generation_config"] = generation_config
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: model.generate_content(prompt, **kwargs)
            )
            return response.text
        except Exception as e:
            last_exc = e
            msg = str(e).lower()
            if "rate" in msg or "429" in msg or "quota" in msg:
                wait = backoff * (2 ** attempt)
                await asyncio.sleep(min(wait, 30))
                continue
            if attempt < max_retries - 1:
                await asyncio.sleep(backoff * attempt)
                continue
    raise last_exc


async def gemini_generate_json(prompt: str, model_name: str = "gemini-2.5-flash",
                                max_retries: int = 2) -> str:
    return await gemini_generate(
        prompt,
        model_name=model_name,
        max_retries=max_retries,
        generation_config={"response_mime_type": "application/json"},
    )
