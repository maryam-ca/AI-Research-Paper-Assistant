from __future__ import annotations

import time
from typing import TypedDict

from langgraph.graph import StateGraph, END

from backend.app.ingestion.pdf_loader import extract_text_from_pdf
from backend.app.storage.vector_store import chunk_text, embed_and_store
from backend.app.processing.summarizer import (
    generate_executive_summary,
    generate_detailed_summary,
    generate_key_findings,
)
from backend.app.processing.extractor import extract_key_elements
from backend.app.processing.attribution import flag_summaries


class PaperState(TypedDict):
    file_path: str
    paper_id: str
    pages: list[dict] | None
    chunks: list[dict] | None
    full_text: str
    executive_summary: str | None
    detailed_summary: str | None
    key_findings: str | None
    key_elements: dict | None
    attribution_report: dict | None
    created_at: float
    stage: str
    error: str | None


def _node_extract(state: PaperState) -> PaperState:
    try:
        pages = extract_text_from_pdf(state["file_path"])
        full_text = "\n\n".join(p["text"] for p in pages)
        return {"pages": pages, "full_text": full_text, "stage": "extract_text"}
    except Exception as e:
        return {"stage": "extract_text:failed", "error": str(e)}


def _node_chunk_embed(state: PaperState) -> PaperState:
    try:
        chunks = chunk_text(state["pages"])
        embed_and_store(state["paper_id"], chunks)
        return {"chunks": chunks, "stage": "chunk_and_embed"}
    except Exception as e:
        return {"stage": "chunk_and_embed:failed", "error": str(e)}


def _node_summarize(state: PaperState) -> PaperState:
    try:
        text = state["full_text"]
        executive_summary = generate_executive_summary(text)
        detailed_summary = generate_detailed_summary(text)
        key_findings = generate_key_findings(text)
        return {
            "executive_summary": executive_summary,
            "detailed_summary": detailed_summary,
            "key_findings": key_findings,
            "stage": "summarize",
        }
    except Exception as e:
        return {"stage": "summarize:failed", "error": str(e)}


def _node_extract_elements(state: PaperState) -> PaperState:
    try:
        key_elements = extract_key_elements(state["full_text"])
        return {"key_elements": key_elements, "stage": "extract_elements"}
    except Exception as e:
        return {"stage": "extract_elements:failed", "error": str(e)}


def _node_check_attribution(state: PaperState) -> PaperState:
    try:
        report = flag_summaries(
            state["executive_summary"],
            state["detailed_summary"],
            state["key_findings"],
            state["paper_id"],
        )
        return {"attribution_report": report, "stage": "check_attribution"}
    except Exception as e:
        return {"stage": "check_attribution:failed", "error": str(e)}


def _node_done(state: PaperState) -> PaperState:
    return {"stage": "done"}


def _route_after_extract(state: PaperState) -> str:
    return END if state["stage"].endswith(":failed") else "chunk_and_embed"


def _route_after_chunk_embed(state: PaperState) -> str:
    return END if state["stage"].endswith(":failed") else "summarize"


def _route_after_summarize(state: PaperState) -> str:
    return END if state["stage"].endswith(":failed") else "extract_elements"


def _route_after_extract_elements(state: PaperState) -> str:
    return END if state["stage"].endswith(":failed") else "check_attribution"


def _route_after_attribution(state: PaperState) -> str:
    return END if state["stage"].endswith(":failed") else "done_node"


def build_graph():
    graph = StateGraph(PaperState)

    graph.add_node("extract_text", _node_extract)
    graph.add_node("chunk_and_embed", _node_chunk_embed)
    graph.add_node("summarize", _node_summarize)
    graph.add_node("extract_elements", _node_extract_elements)
    graph.add_node("check_attribution", _node_check_attribution)
    graph.add_node("done_node", _node_done)

    graph.set_entry_point("extract_text")

    graph.add_conditional_edges("extract_text", _route_after_extract, {
        "chunk_and_embed": "chunk_and_embed",
        END: END,
    })
    graph.add_conditional_edges("chunk_and_embed", _route_after_chunk_embed, {
        "summarize": "summarize",
        END: END,
    })
    graph.add_conditional_edges("summarize", _route_after_summarize, {
        "extract_elements": "extract_elements",
        END: END,
    })
    graph.add_conditional_edges("extract_elements", _route_after_extract_elements, {
        "check_attribution": "check_attribution",
        END: END,
    })
    graph.add_conditional_edges("check_attribution", _route_after_attribution, {
        "done_node": "done_node",
        END: END,
    })

    graph.add_edge("done_node", END)

    return graph.compile()
