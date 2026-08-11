import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET


def fetch_arxiv_metadata(arxiv_id: str) -> dict:
    url = f"http://export.arxiv.org/api/query?id_list={urllib.parse.quote(arxiv_id)}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            xml_data = resp.read()
    except Exception as e:
        raise ConnectionError(f"Failed to fetch arXiv metadata for '{arxiv_id}': {e}")

    root = ET.fromstring(xml_data)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    entry = root.find("atom:entry", ns)
    if entry is None:
        raise ValueError(f"No results found for arXiv ID '{arxiv_id}'")

    title = (entry.findtext("atom:title", "", ns) or "").strip().replace("\n", " ")
    abstract = (entry.findtext("atom:summary", "", ns) or "").strip().replace("\n", " ")
    authors = [
        a.findtext("atom:name", "", ns)
        for a in entry.findall("atom:author", ns)
    ]
    published = (entry.findtext("atom:published", "", ns) or "")[:10]
    subjects = [
        cat.get("term")
        for cat in entry.findall("atom:category", ns)
        if cat.get("term")
    ]

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "published_date": published,
        "source": f"arxiv:{arxiv_id}",
        "subjects": subjects,
    }


def fetch_doi_metadata(doi: str) -> dict:
    url = f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe=':/')}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        raise ConnectionError(f"Failed to fetch Crossref metadata for '{doi}': {e}")

    msg = data.get("message", {})
    title = (msg.get("title") or [""])[0]
    authors = [
        f"{a.get('given', '')} {a.get('family', '')}".strip()
        for a in msg.get("author", [])
    ]
    abstract = (msg.get("abstract") or "").strip()
    pub_date = ""
    date_parts = msg.get("published-print") or msg.get("published-online")
    if date_parts and date_parts.get("date-parts"):
        pp = date_parts["date-parts"][0]
        pub_date = "-".join(str(p).zfill(2) for p in pp if p)

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "published_date": pub_date,
        "source": f"doi:{doi}",
    }
