import re


def _bibkey(metadata: dict) -> str:
    first_author = (metadata.get("authors") or ["unknown"])[0].split()[-1].lower()
    year = (metadata.get("published_date") or "")[:4]
    slug = re.sub(r"[^a-z0-9]", "", metadata.get("title", "")[:20].lower())
    return f"{first_author}{year}{slug}"


def _format_authors_apa(authors: list[str]) -> str:
    if not authors:
        return ""
    if len(authors) == 1:
        return authors[0]
    if len(authors) == 2:
        return f"{authors[0]} & {authors[1]}"
    return ", ".join(authors[:-1]) + f", & {authors[-1]}"


def _format_authors_mla(authors: list[str]) -> str:
    if not authors:
        return ""
    if len(authors) == 1:
        return authors[0]
    if len(authors) == 2:
        return f"{authors[0]}, and {authors[1]}"
    return f"{authors[0]}, et al."


def generate_citation(metadata: dict, style: str) -> str:
    title = metadata.get("title", "Untitled")
    authors = metadata.get("authors", [])
    date = metadata.get("published_date", "")
    source = metadata.get("source", "")

    year = date[:4] if len(date) >= 4 else "n.d."
    month_day = date[5:] if len(date) > 4 else ""

    if style == "bibtex":
        bib_type = "article"
        key = _bibkey(metadata)
        author_str = " and ".join(authors)
        return (
            f"@{bib_type}{{{key},\n"
            f"  title     = {{{title}}},\n"
            f"  author    = {{{author_str}}},\n"
            f"  year      = {{{year}}},\n"
            f"  month     = {{{month_day}}},\n"
            f"  source    = {{{source}}}\n"
            f"}}"
        )

    if style == "apa":
        author_str = _format_authors_apa(authors)
        return f"{author_str} ({year}). {title}. {source}."

    if style == "mla":
        author_str = _format_authors_mla(authors)
        return f'{author_str}. "{title}." {source}, {year}.'

    raise ValueError(f"Unsupported citation style: '{style}'. Choose 'bibtex', 'apa', or 'mla'.")
