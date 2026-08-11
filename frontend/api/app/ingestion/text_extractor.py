"""
Universal text extractor — supports PDF, TXT, Markdown, HTML, DOCX, RTF, TeX.
Returns a list of dicts: [{"page": 1, "text": "..."}, ...]
"""
from pathlib import Path


def extract_text(file_path: str) -> list[dict]:
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(file_path)
    if ext in (".txt", ".md", ".markdown"):
        return _extractPlainText(file_path)
    if ext in (".html", ".htm"):
        return _extract_html(file_path)
    if ext in (".docx", ".doc"):
        return _extract_docx(file_path)
    if ext == ".rtf":
        return _extract_rtf(file_path)
    if ext in (".tex", ".latex"):
        return _extract_tex(file_path)

    # Fallback: try reading as plain text
    return _extractPlainText(file_path)


def _extract_pdf(file_path: str) -> list[dict]:
    from pypdf import PdfReader
    try:
        reader = PdfReader(file_path)
    except Exception as e:
        raise ValueError(f"Could not read PDF: {e}")

    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            pages.append({"page": i + 1, "text": text.strip()})

    if not pages:
        raise ValueError("No extractable text found. The PDF may be scanned or image-only.")
    return pages


def _extractPlainText(file_path: str) -> list[dict]:
    try:
        text = Path(file_path).read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise ValueError(f"Could not read file: {e}")

    text = text.strip()
    if not text:
        raise ValueError("File is empty.")

    # Split into ~3000-char page-like chunks for consistency
    chunk_size = 3000
    pages = []
    for i in range(0, len(text), chunk_size):
        pages.append({"page": len(pages) + 1, "text": text[i : i + chunk_size]})
    return pages


def _extract_html(file_path: str) -> list[dict]:
    try:
        from html.parser import HTMLParser
        import re

        class TextExtractor(HTMLParser):
            def __init__(self):
                super().__init__()
                self.parts = []
            def handle_data(self, data):
                self.parts.append(data)

        raw = Path(file_path).read_text(encoding="utf-8", errors="replace")
        extractor = TextExtractor()
        extractor.feed(raw)
        text = " ".join(extractor.parts)
        text = re.sub(r"\s+", " ", text).strip()
    except Exception as e:
        raise ValueError(f"Could not parse HTML: {e}")

    if not text:
        raise ValueError("No text content found in HTML file.")

    chunk_size = 3000
    pages = []
    for i in range(0, len(text), chunk_size):
        pages.append({"page": len(pages) + 1, "text": text[i : i + chunk_size]})
    return pages


def _extract_docx(file_path: str) -> list[dict]:
    try:
        import docx2txt
        text = docx2txt.process(file_path)
    except ImportError:
        # Fallback: try python-docx
        try:
            from docx import Document
            doc = Document(file_path)
            text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            raise ValueError(
                "DOCX support requires 'docx2txt' or 'python-docx'. "
                "Install with: pip install docx2txt"
            )
    except Exception as e:
        raise ValueError(f"Could not read DOCX: {e}")

    text = text.strip()
    if not text:
        raise ValueError("DOCX file contains no text.")

    chunk_size = 3000
    pages = []
    for i in range(0, len(text), chunk_size):
        pages.append({"page": len(pages) + 1, "text": text[i : i + chunk_size]})
    return pages


def _extract_rtf(file_path: str) -> list[dict]:
    try:
        from striprtf.striprtf import rtf_to_text
        raw = Path(file_path).read_text(encoding="utf-8", errors="replace")
        text = rtf_to_text(raw)
    except ImportError:
        raise ValueError("RTF support requires 'striprtf'. Install with: pip install striprtf")
    except Exception as e:
        raise ValueError(f"Could not parse RTF: {e}")

    text = text.strip()
    if not text:
        raise ValueError("RTF file contains no text.")

    chunk_size = 3000
    pages = []
    for i in range(0, len(text), chunk_size):
        pages.append({"page": len(pages) + 1, "text": text[i : i + chunk_size]})
    return pages


def _extract_tex(file_path: str) -> list[dict]:
    import re
    try:
        raw = Path(file_path).read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise ValueError(f"Could not read TeX file: {e}")

    # Strip LaTeX commands, keep content
    text = re.sub(r"\\begin\{[^}]*\}", "", raw)
    text = re.sub(r"\\end\{[^}]*\}", "", text)
    text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?\{([^}]*)\}", r"\2", text)
    text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?", "", text)
    text = re.sub(r"[{}]", "", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        raise ValueError("No text content found in TeX file.")

    chunk_size = 3000
    pages = []
    for i in range(0, len(text), chunk_size):
        pages.append({"page": len(pages) + 1, "text": text[i : i + chunk_size]})
    return pages
