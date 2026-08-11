from ..llm_client import gemini_generate
import re
import math


async def generate_executive_summary(paper_text: str, instruction: str = "", length: str = "medium") -> str:
    length_instructions = {
        "short": "in 2-3 sentences (very concise)",
        "medium": "in 3-5 sentences",
        "long": "in 6-8 sentences (more comprehensive)",
    }
    length_desc = length_instructions.get(length, length_instructions["medium"])
    extra = f"\n\nAdditional instructions from the user: {instruction}" if instruction else ""
    prompt = (
        f"You are a research assistant. Summarize the following research paper "
        f"in a concise executive summary {length_desc}. Stay strictly grounded "
        f"in the provided text. Do not add any information or facts not present "
        f"in the original paper."
        f"{extra}\n\n"
        f"Paper text:\n{paper_text}"
    )
    return await gemini_generate(prompt)


async def generate_detailed_summary(paper_text: str, instruction: str = "", length: str = "medium") -> str:
    length_instructions = {
        "short": "concise (2-3 paragraphs)",
        "medium": "standard detail (4-6 paragraphs)",
        "long": "comprehensive (7-10 paragraphs)",
    }
    length_desc = length_instructions.get(length, length_instructions["medium"])
    extra = f"\n\nAdditional instructions from the user: {instruction}" if instruction else ""
    prompt = (
        f"You are a research assistant. Provide a detailed summary of the "
        f"following research paper, covering its motivation, methodology, "
        f"results, and conclusions. Make it {length_desc}. Stay strictly grounded in the provided "
        f"text. Do not add any information or facts not present in the "
        f"original paper."
        f"{extra}\n\n"
        f"Paper text:\n{paper_text}"
    )
    return await gemini_generate(prompt)


async def generate_key_findings(paper_text: str, instruction: str = "", length: str = "medium") -> str:
    length_instructions = {
        "short": "3-5 key findings",
        "medium": "5-8 key findings",
        "long": "8-12 key findings",
    }
    length_desc = length_instructions.get(length, length_instructions["medium"])
    extra = f"\n\nAdditional instructions from the user: {instruction}" if instruction else ""
    prompt = (
        f"You are a research assistant. Extract the key findings from the "
        f"following research paper as a numbered list with {length_desc}. Each finding must be "
        f"directly supported by the text. Do not add any information or facts "
        f"not present in the original paper."
        f"{extra}\n\n"
        f"Paper text:\n{paper_text}"
    )
    return await gemini_generate(prompt)


async def regenerate_section(paper_text: str, section: str, instruction: str = "", length: str = "medium") -> str:
    generators = {
        "executive": generate_executive_summary,
        "detailed": generate_detailed_summary,
        "findings": generate_key_findings,
    }
    gen = generators.get(section)
    if not gen:
        raise ValueError(f"Unknown section: {section}. Must be one of: {list(generators.keys())}")
    return await gen(paper_text, instruction, length)


async def generate_simplified_summary(paper_text: str, instruction: str = "") -> str:
    extra = f"\n\nAdditional instructions from the user: {instruction}" if instruction else ""
    prompt = (
        "You are a research assistant explaining a paper to someone who is NEW to this field. "
        "Write a clear, accessible summary that:\n"
        "1. Explains the problem in simple terms (what problem does this solve?)\n"
        "2. Describes the approach without jargon (how did they do it?)\n"
        "3. States the key results in plain language (what did they find?)\n"
        "4. Explains why this matters (what's the impact?)\n"
        "Avoid technical jargon, acronyms, and field-specific terminology. "
        "Use analogies where helpful. Write at an undergraduate level. "
        "Stay strictly grounded in the provided text. Do not add outside facts."
        f"{extra}\n\n"
        f"Paper text:\n{paper_text}"
    )
    return await gemini_generate(prompt)


def compute_readability_scores(text: str) -> dict:
    if not text or len(text.strip()) < 100:
        return {"flesch_kincaid_grade": None, "flesch_reading_ease": None, "difficulty_label": "Unknown"}

    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    num_sentences = len(sentences)

    words = re.findall(r'\b\w+\b', text.lower())
    num_words = len(words)

    if num_sentences == 0 or num_words == 0:
        return {"flesch_kincaid_grade": None, "flesch_reading_ease": None, "difficulty_label": "Unknown"}

    syllables = 0
    for word in words:
        syllables += count_syllables(word)

    avg_sentence_length = num_words / num_sentences
    avg_syllables_per_word = syllables / num_words

    flesch_reading_ease = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
    flesch_kincaid_grade = (0.39 * avg_sentence_length) + (11.8 * avg_syllables_per_word) - 15.59

    flesch_reading_ease = max(0, min(100, flesch_reading_ease))
    flesch_kincaid_grade = max(0, flesch_kincaid_grade)

    if flesch_reading_ease >= 80:
        difficulty_label = "Very Easy"
    elif flesch_reading_ease >= 70:
        difficulty_label = "Easy"
    elif flesch_reading_ease >= 60:
        difficulty_label = "Fairly Easy"
    elif flesch_reading_ease >= 50:
        difficulty_label = "Standard"
    elif flesch_reading_ease >= 30:
        difficulty_label = "Fairly Difficult"
    elif flesch_reading_ease >= 10:
        difficulty_label = "Difficult"
    else:
        difficulty_label = "Very Difficult"

    return {
        "flesch_kincaid_grade": round(flesch_kincaid_grade, 1),
        "flesch_reading_ease": round(flesch_reading_ease, 1),
        "difficulty_label": difficulty_label,
        "avg_sentence_length": round(avg_sentence_length, 1),
        "avg_syllables_per_word": round(avg_syllables_per_word, 2),
        "word_count": num_words,
        "sentence_count": num_sentences,
    }


def count_syllables(word: str) -> int:
    word = word.lower()
    if len(word) <= 3:
        return 1
    vowels = "aeiouy"
    count = 0
    prev_char_vowel = False
    for char in word:
        is_vowel = char in vowels
        if is_vowel and not prev_char_vowel:
            count += 1
        prev_char_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


async def translate_summary(summary: str, target_language: str) -> str:
    language_names = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "zh": "Chinese (Simplified)",
        "ja": "Japanese",
        "ko": "Korean",
        "pt": "Portuguese",
        "it": "Italian",
        "ru": "Russian",
        "ar": "Arabic",
        "hi": "Hindi",
        "nl": "Dutch",
        "pl": "Polish",
        "tr": "Turkish",
    }
    lang_name = language_names.get(target_language, target_language)
    prompt = (
        f"You are a professional translator. Translate the following research paper summary "
        f"into {lang_name}. Maintain the academic tone and technical accuracy. "
        f"Preserve any citations like [page X]. Do not add or remove information.\n\n"
        f"Summary:\n{summary}"
    )
    return await gemini_generate(prompt)


async def suggest_tags(paper_text: str) -> list[str]:
    prompt = (
        "You are a research assistant. Analyze the following research paper and suggest 3-5 relevant tags "
        "that categorize the paper's topic, domain, methodology, and key concepts. "
        "Return ONLY a JSON array of strings. Each tag should be concise (1-3 words), "
        "lowercase, and use hyphens for multi-word tags.\n\n"
        "Examples of good tags: \"machine-learning\", \"computer-vision\", \"transformer-architecture\", "
        "\"reinforcement-learning\", \"natural-language-processing\", \"medical-imaging\", "
        "\"climate-science\", \"quantum-computing\", \"bioinformatics\", \"robotics\".\n\n"
        f"Paper text:\n{paper_text}"
    )
    raw = await gemini_generate(prompt, generation_config={"response_mime_type": "application/json"})
    try:
        import json as _json
        tags = _json.loads(raw)
        if isinstance(tags, list):
            return [str(t).strip().lower().replace(" ", "-") for t in tags[:5] if t]
    except Exception:
        pass
    return []
