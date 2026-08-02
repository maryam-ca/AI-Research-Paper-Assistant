import os
import time
import google.generativeai as genai


def get_gemini_model(model_name: str = "gemini-2.0-flash"):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)


def gemini_generate(prompt: str, model_name: str = "gemini-2.0-flash",
                    max_retries: int = 3, backoff: float = 2.0,
                    generation_config: dict | None = None) -> str:
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


def gemini_generate_json(prompt: str, model_name: str = "gemini-2.0-flash",
                         max_retries: int = 3) -> str:
    return gemini_generate(
        prompt,
        model_name=model_name,
        max_retries=max_retries,
        generation_config={"response_mime_type": "application/json"},
    )
