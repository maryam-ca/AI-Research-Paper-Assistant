from pypdf import PdfReader


def extract_text_from_pdf(file_path: str) -> list[dict]:
    try:
        reader = PdfReader(file_path)
    except Exception as e:
        raise ValueError(f"Could not read PDF at '{file_path}': {e}")

    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            pages.append({"page": i + 1, "text": text})

    if not pages:
        raise ValueError(
            f"No extractable text found in '{file_path}'. "
            "The PDF may be scanned or contain only images."
        )

    return pages
