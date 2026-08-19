"""Fetch metadata + PDF from arXiv and Crossref (DOI)."""
import re
import logging
import requests

logger = logging.getLogger("metadata_fetcher")

ARXIV_API = "http://export.arxiv.org/api/query"
CROSSREF_API = "https://api.crossref.org/works"


def _arxiv_id_from_input(value: str) -> str:
    m = re.search(r"(?:arxiv\.org/abs/)?(\d{4}\.\d{4,5})(?:v\d+)?", value)
    return m.group(1) if m else value.strip()


def fetch_arxiv_metadata(arxiv_id: str) -> dict:
    aid = _arxiv_id_from_input(arxiv_id)
    resp = requests.get(ARXIV_API, params={"id_list": aid, "max_results": 1}, timeout=30)
    resp.raise_for_status()
    import xml.etree.ElementTree as ET
    ns = {"a": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(resp.text)
    entry = root.find("a:entry", ns)
    if entry is None:
        raise ValueError(f"arXiv ID {aid} not found")
    title = (entry.find("a:title", ns).text or "").strip().replace("\n", " ")
    authors = [a.find("a:name", ns).text for a in entry.findall("a:author", ns)]
    summary = (entry.find("a:summary", ns).text or "").strip()
    pdf_url = None
    for link in entry.findall("a:link", ns):
        if link.get("title") == "pdf":
            pdf_url = link.get("href")
    return {
        "title": title,
        "authors": authors,
        "abstract": summary,
        "pdf_url": pdf_url or f"https://arxiv.org/pdf/{aid}",
        "source_id": aid,
    }


def fetch_doi_metadata(doi: str) -> dict:
    doi = doi.strip()
    resp = requests.get(f"{CROSSREF_API}/{requests.utils.quote(doi)}", timeout=30)
    resp.raise_for_status()
    msg = resp.json()["message"]
    title = msg.get("title", ["Unknown"])[0]
    authors = [" ".join(filter(None, (a.get("given"), a.get("family")))) for a in msg.get("author", [])]
    abstract = msg.get("abstract", "")
    # Best-effort PDF link
    pdf_url = None
    for link in msg.get("link", []):
        if link.get("content-type") == "application/pdf":
            pdf_url = link.get("URL")
            break
    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "pdf_url": pdf_url,
        "source_id": doi,
    }


def fetch_url_metadata(url: str) -> dict:
    """Accept a document link: arXiv URL, DOI URL, or a direct PDF/document link."""
    url = url.strip()
    low = url.lower()
    if "arxiv.org" in low:
        return fetch_arxiv_metadata(_arxiv_id_from_input(url))
    if "doi.org/" in low:
        doi = url.split("doi.org/", 1)[1].strip("/")
        return fetch_doi_metadata(doi)
    if low.startswith("10.") or "doi:" in low:
        return fetch_doi_metadata(url.replace("doi:", "").strip())
    # Direct document link: download and analyze, derive a title from the filename.
    fname = url.rstrip("/").split("/")[-1] or "document"
    title = re.sub(r"\.[^.]+$", "", fname).replace("_", " ").replace("-", " ")
    return {
        "title": title or "Document",
        "authors": [],
        "abstract": "",
        "pdf_url": url,
        "source_id": url,
    }
