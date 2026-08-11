import json
import os
import time
import uuid
from typing import Optional

from .database import get_pool, close_pool

SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
    paper_id         TEXT PRIMARY KEY,
    filename         TEXT NOT NULL,
    metadata         JSONB,
    executive_summary TEXT,
    detailed_summary  TEXT,
    key_findings      TEXT,
    key_elements      JSONB,
    attribution_report JSONB,
    created_at       DOUBLE PRECISION NOT NULL,
    last_viewed      DOUBLE PRECISION,
    source_file      TEXT,
    reading_progress JSONB DEFAULT '{}',
    status           TEXT DEFAULT 'to_read'
);

CREATE TABLE IF NOT EXISTS collections (
    collection_id TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT '',
    category      TEXT DEFAULT '',
    color         TEXT DEFAULT '#3525cd',
    created_at    DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_papers (
    collection_id TEXT NOT NULL,
    paper_id      TEXT NOT NULL,
    added_at      DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (collection_id, paper_id),
    FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(paper_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    note_id    TEXT PRIMARY KEY,
    paper_id   TEXT NOT NULL,
    text       TEXT NOT NULL,
    page_ref   INTEGER,
    created_at DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(paper_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note_versions (
    version_id  TEXT PRIMARY KEY,
    note_id     TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(note_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qa_history (
    qa_id       TEXT PRIMARY KEY,
    paper_id    TEXT NOT NULL,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    sources     JSONB,
    follow_ups  JSONB,
    created_at  DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(paper_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
    activity_id TEXT PRIMARY KEY,
    action      TEXT NOT NULL,
    detail      TEXT DEFAULT '',
    paper_id    TEXT,
    created_at  DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    paper_id        TEXT,
    read            INTEGER DEFAULT 0,
    created_at      DOUBLE PRECISION NOT NULL
);
"""


async def get_pool() -> asyncpg.Pool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA)
    return pool


async def _fetchrow(sql: str, *args):
    pool = await get_pool()
    return await pool.fetchrow(sql, *args)


async def _fetch(sql: str, *args):
    pool = await get_pool()
    return await pool.fetch(sql, *args)


async def _execute(sql: str, *args):
    pool = await get_pool()
    return await pool.execute(sql, *args)


def _row_to_dict(row) -> dict:
    if row is None:
        return None
    d = dict(row)
    if "paper_id" in d:
        d["id"] = d.pop("paper_id")
    for key in ("metadata", "key_elements", "attribution_report"):
        if d.get(key) is not None:
            if isinstance(d[key], str):
                d[key] = json.loads(d[key])
    if d.get("reading_progress") is not None:
        if isinstance(d["reading_progress"], str):
            try:
                d["reading_progress"] = json.loads(d["reading_progress"])
            except (json.JSONDecodeError, TypeError):
                d["reading_progress"] = {}
        elif not isinstance(d["reading_progress"], dict):
            d["reading_progress"] = {}
    return d


# ---------------------------------------------------------------------------
# Papers
# ---------------------------------------------------------------------------

async def save_paper(paper: dict):
    pid = paper.get("id") or paper.get("paper_id")
    meta = paper.get("metadata")
    meta_json = json.dumps(meta) if meta is not None else None
    key_elements = paper.get("key_elements")
    ke_json = json.dumps(key_elements) if key_elements is not None else None
    attr = paper.get("attribution_report")
    attr_json = json.dumps(attr) if attr is not None else None
    progress = paper.get("reading_progress", {})
    progress_json = json.dumps(progress)
    await _execute(
        """INSERT INTO papers
           (paper_id, filename, metadata, executive_summary, detailed_summary,
            key_findings, key_elements, attribution_report, created_at,
            source_file, reading_progress, status)
           VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12)
           ON CONFLICT (paper_id) DO UPDATE SET
             filename=EXCLUDED.filename, metadata=EXCLUDED.metadata,
             executive_summary=EXCLUDED.executive_summary,
             detailed_summary=EXCLUDED.detailed_summary,
             key_findings=EXCLUDED.key_findings,
             key_elements=EXCLUDED.key_elements,
             attribution_report=EXCLUDED.attribution_report,
             source_file=EXCLUDED.source_file,
             reading_progress=EXCLUDED.reading_progress,
             status=EXCLUDED.status""",
        pid,
        paper["filename"],
        meta_json,
        paper.get("executive_summary"),
        paper.get("detailed_summary"),
        paper.get("key_findings"),
        ke_json,
        attr_json,
        paper["created_at"],
        paper.get("source_file"),
        progress_json,
        paper.get("status", "to_read"),
    )


async def get_paper(paper_id: str) -> dict | None:
    row = await _fetchrow("SELECT * FROM papers WHERE paper_id = $1", paper_id)
    return _row_to_dict(row)


async def list_papers() -> list[dict]:
    rows = await _fetch("SELECT * FROM papers ORDER BY created_at DESC")
    return [_row_to_dict(r) for r in rows]


async def delete_paper(paper_id: str) -> bool:
    tag = await _execute("DELETE FROM papers WHERE paper_id = $1", paper_id)
    return "DELETE 0" not in tag


async def purge_expired(max_age_days: int = 30) -> list[str]:
    cutoff = time.time() - (max_age_days * 86400)
    rows = await _fetch("SELECT paper_id FROM papers WHERE created_at < $1", cutoff)
    ids = [r["paper_id"] for r in rows]
    if ids:
        await _execute("DELETE FROM papers WHERE paper_id = ANY($1)", ids)
    return ids


# ---------------------------------------------------------------------------
# Last-viewed tracking
# ---------------------------------------------------------------------------

async def touch_paper(paper_id: str):
    await _execute("UPDATE papers SET last_viewed = $1 WHERE paper_id = $2", time.time(), paper_id)


async def list_papers_recent(limit: int = 50) -> list[dict]:
    rows = await _fetch(
        "SELECT * FROM papers WHERE last_viewed IS NOT NULL ORDER BY last_viewed DESC LIMIT $1",
        limit,
    )
    return [_row_to_dict(r) for r in rows]


async def get_reading_reminders(days_threshold: int = 30) -> list[dict]:
    cutoff = time.time() - (days_threshold * 86400)
    rows = await _fetch(
        """SELECT * FROM papers
           WHERE status = 'to_read' AND (last_viewed IS NULL OR last_viewed < $1)
           ORDER BY created_at ASC""",
        cutoff,
    )
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

async def update_paper_tags(paper_id: str, tags: list[str]):
    row = await _fetchrow("SELECT metadata FROM papers WHERE paper_id = $1", paper_id)
    if row is None:
        return
    meta = json.loads(row["metadata"]) if row["metadata"] else {}
    meta["tags"] = tags
    await _execute("UPDATE papers SET metadata = $1::jsonb WHERE paper_id = $2", json.dumps(meta), paper_id)


async def search_papers(query: str) -> list[dict]:
    q = f"%{query}%"
    rows = await _fetch(
        """SELECT * FROM papers
           WHERE filename ILIKE $1 OR executive_summary ILIKE $1
              OR detailed_summary ILIKE $1 OR metadata::text ILIKE $1
           ORDER BY created_at DESC""",
        q,
    )
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

async def create_collection(name: str, description: str = "", category: str = "") -> dict:
    cid = uuid.uuid4().hex[:12]
    await _execute(
        "INSERT INTO collections (collection_id, name, description, category, created_at) VALUES ($1,$2,$3,$4,$5)",
        cid, name, description, category, time.time(),
    )
    return {"id": cid, "name": name, "description": description, "category": category}


async def list_collections() -> list[dict]:
    rows = await _fetch("SELECT * FROM collections ORDER BY created_at DESC")
    result = []
    for r in rows:
        d = dict(r)
        d["id"] = d.pop("collection_id")
        d.setdefault("category", "")
        cnt = await _fetchrow(
            "SELECT COUNT(*) as cnt FROM collection_papers WHERE collection_id = $1", d["id"]
        )
        d["paper_count"] = cnt["cnt"] if cnt else 0
        result.append(d)
    return result


async def get_collection(collection_id: str) -> dict | None:
    row = await _fetchrow("SELECT * FROM collections WHERE collection_id = $1", collection_id)
    if row is None:
        return None
    d = dict(row)
    d["id"] = d.pop("collection_id")
    d.setdefault("category", "")
    paper_rows = await _fetch(
        """SELECT p.* FROM papers p
           JOIN collection_papers cp ON p.paper_id = cp.paper_id
           WHERE cp.collection_id = $1
           ORDER BY cp.added_at DESC""",
        collection_id,
    )
    d["papers"] = [_row_to_dict(r) for r in paper_rows]
    return d


async def rename_collection(collection_id: str, name: str) -> bool:
    tag = await _execute("UPDATE collections SET name = $1 WHERE collection_id = $2", name, collection_id)
    return "UPDATE 0" not in tag


async def delete_collection(collection_id: str) -> bool:
    await _execute("DELETE FROM collection_papers WHERE collection_id = $1", collection_id)
    tag = await _execute("DELETE FROM collections WHERE collection_id = $1", collection_id)
    return "DELETE 0" not in tag


async def add_paper_to_collection(collection_id: str, paper_id: str) -> bool:
    try:
        await _execute(
            "INSERT INTO collection_papers (collection_id, paper_id, added_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
            collection_id, paper_id, time.time(),
        )
        return True
    except Exception:
        return False


async def remove_paper_from_collection(collection_id: str, paper_id: str) -> bool:
    tag = await _execute(
        "DELETE FROM collection_papers WHERE collection_id = $1 AND paper_id = $2",
        collection_id, paper_id,
    )
    return "DELETE 0" not in tag


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

async def add_note(paper_id: str, text: str, page_ref: int | None = None) -> dict:
    nid = uuid.uuid4().hex[:12]
    await _execute(
        "INSERT INTO notes (note_id, paper_id, text, page_ref, created_at) VALUES ($1,$2,$3,$4,$5)",
        nid, paper_id, text, page_ref, time.time(),
    )
    return {"id": nid, "paper_id": paper_id, "text": text, "page_ref": page_ref}


async def list_notes(paper_id: str) -> list[dict]:
    rows = await _fetch("SELECT * FROM notes WHERE paper_id = $1 ORDER BY created_at ASC", paper_id)
    return [{"id": r["note_id"], "paper_id": r["paper_id"], "text": r["text"],
             "page_ref": r["page_ref"], "created_at": r["created_at"]} for r in rows]


async def delete_note(note_id: str) -> bool:
    tag = await _execute("DELETE FROM notes WHERE note_id = $1", note_id)
    return "DELETE 0" not in tag


async def update_note(note_id: str, text: str) -> bool:
    row = await _fetchrow("SELECT text FROM notes WHERE note_id = $1", note_id)
    if row is None:
        return False
    vid = uuid.uuid4().hex[:12]
    await _execute(
        "INSERT INTO note_versions (version_id, note_id, text, created_at) VALUES ($1,$2,$3,$4)",
        vid, note_id, row["text"], time.time(),
    )
    tag = await _execute("UPDATE notes SET text = $1 WHERE note_id = $2", text, note_id)
    return "UPDATE 0" not in tag


async def get_note_versions(note_id: str) -> list[dict]:
    rows = await _fetch("SELECT * FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC", note_id)
    return [{"id": r["version_id"], "note_id": r["note_id"], "text": r["text"],
             "created_at": r["created_at"]} for r in rows]


async def revert_note(note_id: str, version_id: str) -> bool:
    vrow = await _fetchrow(
        "SELECT text FROM note_versions WHERE version_id = $1 AND note_id = $2",
        version_id, note_id,
    )
    if vrow is None:
        return False
    nrow = await _fetchrow("SELECT text FROM notes WHERE note_id = $1", note_id)
    if nrow is None:
        return False
    vid = uuid.uuid4().hex[:12]
    await _execute(
        "INSERT INTO note_versions (version_id, note_id, text, created_at) VALUES ($1,$2,$3,$4)",
        vid, note_id, nrow["text"], time.time(),
    )
    tag = await _execute("UPDATE notes SET text = $1 WHERE note_id = $2", vrow["text"], note_id)
    return "UPDATE 0" not in tag


# ---------------------------------------------------------------------------
# Q&A History
# ---------------------------------------------------------------------------

async def save_qa(paper_id: str, question: str, answer: str, sources: list[int] | None = None, follow_ups: list[str] | None = None):
    qid = uuid.uuid4().hex[:12]
    await _execute(
        """INSERT INTO qa_history (qa_id, paper_id, question, answer, sources, follow_ups, created_at)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)""",
        qid, paper_id, question, answer,
        json.dumps(sources or []), json.dumps(follow_ups or []), time.time(),
    )


async def list_qa_history(paper_id: str) -> list[dict]:
    rows = await _fetch("SELECT * FROM qa_history WHERE paper_id = $1 ORDER BY created_at ASC", paper_id)
    return [{"id": r["qa_id"], "paper_id": r["paper_id"], "question": r["question"],
             "answer": r["answer"],
             "sources": json.loads(r["sources"]) if isinstance(r["sources"], str) else (r["sources"] or []),
             "created_at": r["created_at"]} for r in rows]


# ---------------------------------------------------------------------------
# Search (notes & QA)
# ---------------------------------------------------------------------------

async def search_notes(query: str) -> list[dict]:
    q = f"%{query}%"
    rows = await _fetch(
        """SELECT n.*, p.filename FROM notes n
           JOIN papers p ON n.paper_id = p.paper_id
           WHERE n.text ILIKE $1
           ORDER BY n.created_at DESC LIMIT 20""",
        q,
    )
    return [{"id": r["note_id"], "paper_id": r["paper_id"], "text": r["text"],
             "page_ref": r["page_ref"], "paper_name": r["filename"],
             "created_at": r["created_at"]} for r in rows]


async def search_qa(query: str) -> list[dict]:
    q = f"%{query}%"
    rows = await _fetch(
        """SELECT q.*, p.filename FROM qa_history q
           JOIN papers p ON q.paper_id = p.paper_id
           WHERE q.question ILIKE $1 OR q.answer ILIKE $1
           ORDER BY q.created_at DESC LIMIT 20""",
        q,
    )
    return [{"id": r["qa_id"], "paper_id": r["paper_id"], "question": r["question"],
             "answer": r["answer"], "paper_name": r["filename"],
             "created_at": r["created_at"]} for r in rows]


# ---------------------------------------------------------------------------
# Clear / Bulk
# ---------------------------------------------------------------------------

async def clear_all_data():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM collection_papers")
        await conn.execute("DELETE FROM collections")
        await conn.execute("DELETE FROM note_versions")
        await conn.execute("DELETE FROM notes")
        await conn.execute("DELETE FROM qa_history")
        await conn.execute("DELETE FROM activity_log")
        await conn.execute("DELETE FROM notifications")
        await conn.execute("DELETE FROM papers")


async def update_reading_progress(paper_id: str, section: str):
    row = await _fetchrow("SELECT reading_progress FROM papers WHERE paper_id = $1", paper_id)
    if row is None:
        return
    progress = row["reading_progress"]
    if isinstance(progress, str):
        progress = json.loads(progress) if progress else {}
    elif not isinstance(progress, dict):
        progress = {}
    progress[section] = True
    await _execute("UPDATE papers SET reading_progress = $1::jsonb WHERE paper_id = $2", json.dumps(progress), paper_id)


async def bulk_delete_papers(paper_ids: list[str]) -> int:
    if not paper_ids:
        return 0
    tag = await _execute("DELETE FROM papers WHERE paper_id = ANY($1)", paper_ids)
    return int(tag.split()[-1]) if tag else 0


async def bulk_export_bibtex(paper_ids: list[str]) -> list[dict]:
    if not paper_ids:
        return []
    rows = await _fetch("SELECT paper_id, metadata FROM papers WHERE paper_id = ANY($1)", paper_ids)
    results = []
    for r in rows:
        meta = r["metadata"]
        if isinstance(meta, str):
            meta = json.loads(meta) if meta else None
        if meta:
            results.append({"id": r["paper_id"], "metadata": meta})
    return results


async def list_all_paper_ids() -> list[str]:
    rows = await _fetch("SELECT paper_id FROM papers")
    return [r["paper_id"] for r in rows]


async def export_all_data() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        paper_rows = await conn.fetch("SELECT * FROM papers ORDER BY created_at DESC")
        papers = []
        for r in paper_rows:
            d = dict(r)
            if "paper_id" in d:
                d["id"] = d.pop("paper_id")
            for key in ("metadata", "key_elements", "attribution_report"):
                if d.get(key) is not None and isinstance(d[key], str):
                    d[key] = json.loads(d[key])
            if d.get("reading_progress") is not None:
                if isinstance(d["reading_progress"], str):
                    try:
                        d["reading_progress"] = json.loads(d["reading_progress"])
                    except (json.JSONDecodeError, TypeError):
                        d["reading_progress"] = {}
            papers.append(d)

        collection_rows = await conn.fetch("SELECT * FROM collections ORDER BY created_at DESC")
        collections = []
        for r in collection_rows:
            d = dict(r)
            d["id"] = d.pop("collection_id")
            d.setdefault("category", "")
            pcr = await conn.fetch(
                "SELECT p.* FROM papers p JOIN collection_papers cp ON p.paper_id = cp.paper_id WHERE cp.collection_id = $1 ORDER BY cp.added_at DESC",
                d["id"],
            )
            d["paper_ids"] = [pr["paper_id"] for pr in pcr]
            collections.append(d)

        note_rows = await conn.fetch("SELECT * FROM notes ORDER BY created_at ASC")
        notes = [{"id": r["note_id"], "paper_id": r["paper_id"], "text": r["text"],
                  "page_ref": r["page_ref"], "created_at": r["created_at"]} for r in note_rows]

        qa_rows = await conn.fetch("SELECT * FROM qa_history ORDER BY created_at ASC")
        qa_history = [{"id": r["qa_id"], "paper_id": r["paper_id"], "question": r["question"],
                       "answer": r["answer"],
                       "sources": json.loads(r["sources"]) if isinstance(r["sources"], str) else (r["sources"] or []),
                       "follow_ups": json.loads(r["follow_ups"]) if isinstance(r["follow_ups"], str) else (r["follow_ups"] or []),
                       "created_at": r["created_at"]} for r in qa_rows]

        version_rows = await conn.fetch("SELECT * FROM note_versions ORDER BY created_at DESC")
        note_versions = [{"id": r["version_id"], "note_id": r["note_id"], "text": r["text"],
                          "created_at": r["created_at"]} for r in version_rows]

        activity_rows = await conn.fetch("SELECT * FROM activity_log ORDER BY created_at DESC")
        activities = [{"id": r["activity_id"], "action": r["action"], "detail": r["detail"],
                       "paper_id": r["paper_id"], "created_at": r["created_at"]} for r in activity_rows]

        notification_rows = await conn.fetch("SELECT * FROM notifications ORDER BY created_at DESC")
        notifications = [{"id": r["notification_id"], "type": r["type"], "title": r["title"],
                          "message": r["message"], "paper_id": r["paper_id"], "read": bool(r["read"]),
                          "created_at": r["created_at"]} for r in notification_rows]

    return {
        "version": "1.0",
        "exported_at": time.time(),
        "papers": papers,
        "collections": collections,
        "notes": notes,
        "qa_history": qa_history,
        "note_versions": note_versions,
        "activities": activities,
        "notifications": notifications,
    }


# ---------------------------------------------------------------------------
# Activity Log
# ---------------------------------------------------------------------------

async def log_activity(action: str, detail: str = "", paper_id: str | None = None):
    aid = uuid.uuid4().hex[:12]
    await _execute(
        "INSERT INTO activity_log (activity_id, action, detail, paper_id, created_at) VALUES ($1,$2,$3,$4,$5)",
        aid, action, detail, paper_id, time.time(),
    )


async def list_activities(limit: int = 50) -> list[dict]:
    rows = await _fetch("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1", limit)
    return [{"id": r["activity_id"], "action": r["action"], "detail": r["detail"],
             "paper_id": r["paper_id"], "created_at": r["created_at"]} for r in rows]


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

async def add_notification(type_: str, title: str, message: str, paper_id: str | None = None):
    nid = uuid.uuid4().hex[:12]
    now = time.time()
    await _execute(
        "INSERT INTO notifications (notification_id, type, title, message, paper_id, read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        nid, type_, title, message, paper_id, 0, now,
    )
    return {"id": nid, "type": type_, "title": title, "message": message, "paper_id": paper_id, "read": False, "created_at": now}


async def list_notifications(limit: int = 50, unread_only: bool = False) -> list[dict]:
    if unread_only:
        rows = await _fetch("SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT $1", limit)
    else:
        rows = await _fetch("SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1", limit)
    return [{"id": r["notification_id"], "type": r["type"], "title": r["title"],
             "message": r["message"], "paper_id": r["paper_id"], "read": bool(r["read"]),
             "created_at": r["created_at"]} for r in rows]


async def mark_notification_read(notification_id: str) -> bool:
    tag = await _execute("UPDATE notifications SET read = 1 WHERE notification_id = $1", notification_id)
    return "UPDATE 0" not in tag


async def mark_all_notifications_read() -> int:
    tag = await _execute("UPDATE notifications SET read = 1 WHERE read = 0")
    return int(tag.split()[-1]) if tag else 0


# ---------------------------------------------------------------------------
# Metadata helper
# ---------------------------------------------------------------------------

async def update_metadata(paper_id: str, metadata: dict):
    await _execute("UPDATE papers SET metadata = $1::jsonb WHERE paper_id = $2", json.dumps(metadata), paper_id)
