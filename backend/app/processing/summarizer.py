from ..llm_client import gemini_generate


def generate_executive_summary(paper_text: str) -> str:
    prompt = (
        "You are a research assistant. Summarize the following research paper "
        "in a concise executive summary (3-5 sentences). Stay strictly grounded "
        "in the provided text. Do not add any information or facts not present "
        "in the original paper.\n\n"
        f"Paper text:\n{paper_text}"
    )
    return gemini_generate(prompt)


def generate_detailed_summary(paper_text: str) -> str:
    prompt = (
        "You are a research assistant. Provide a detailed summary of the "
        "following research paper, covering its motivation, methodology, "
        "results, and conclusions. Stay strictly grounded in the provided "
        "text. Do not add any information or facts not present in the "
        "original paper.\n\n"
        f"Paper text:\n{paper_text}"
    )
    return gemini_generate(prompt)


def generate_key_findings(paper_text: str) -> str:
    prompt = (
        "You are a research assistant. Extract the key findings from the "
        "following research paper as a numbered list. Each finding must be "
        "directly supported by the text. Do not add any information or facts "
        "not present in the original paper.\n\n"
        f"Paper text:\n{paper_text}"
    )
    return gemini_generate(prompt)
