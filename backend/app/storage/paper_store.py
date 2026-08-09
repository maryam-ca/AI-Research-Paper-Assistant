import json
import sqlite3
import threading
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent.parent / "papers.db"
_local = threading.local()


def _conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA foreign_keys=ON")
        _init_schema(_local.conn)
    return _local.conn


def _init_schema(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS papers (
            paper_id    TEXT PRIMARY KEY,
            filename    TEXT NOT NULL,
            metadata    TEXT,
            executive_summary TEXT,
            detailed_summary  TEXT,
            key_findings      TEXT,
            key_elements      TEXT,
            attribution_report TEXT,
            created_at  REAL NOT NULL,
            last_viewed REAL,
            source_file TEXT,
            reading_progress TEXT DEFAULT '{}',
            status      TEXT DEFAULT 'to_read'
        );

        CREATE TABLE IF NOT EXISTS collections (
            collection_id TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            description   TEXT DEFAULT '',
            category      TEXT DEFAULT '',
            color         TEXT DEFAULT '#3525cd',
            created_at    REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collection_papers (
            collection_id TEXT NOT NULL,
            paper_id      TEXT NOT NULL,
            added_at      REAL NOT NULL,
            PRIMARY KEY (collection_id, paper_id),
            FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
            FOREIGN KEY (paper_id) REFERENCES papers(paper_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notes (
            note_id    TEXT PRIMARY KEY,
            paper_id   TEXT NOT NULL,
            text       TEXT NOT NULL,
            page_ref   INTEGER,
            created_at REAL NOT NULL,
            FOREIGN KEY (paper_id) REFERENCES papers(paper_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS qa_history (
            qa_id       TEXT PRIMARY KEY,
            paper_id    TEXT NOT NULL,
            question    TEXT NOT NULL,
            answer      TEXT NOT NULL,
            sources     TEXT,
            follow_ups  TEXT,
            created_at  REAL NOT NULL,
            FOREIGN KEY (paper_id) REFERENCES papers(paper_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS note_versions (
            version_id  TEXT PRIMARY KEY,
            note_id     TEXT NOT NULL,
            text        TEXT NOT NULL,
            created_at  REAL NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(note_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            activity_id TEXT PRIMARY KEY,
            action      TEXT NOT NULL,
            detail      TEXT DEFAULT '',
            paper_id    TEXT,
            created_at  REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            notification_id TEXT PRIMARY KEY,
            type          TEXT NOT NULL,
            title         TEXT NOT NULL,
            message       TEXT NOT NULL,
            paper_id      TEXT,
            read          INTEGER DEFAULT 0,
            created_at    REAL NOT NULL
        );
    """)
    _migrate_add_column(conn, "papers", "last_viewed", "REAL")
    _migrate_add_column(conn, "papers", "source_file", "TEXT")
    _migrate_add_column(conn, "papers", "reading_progress", "TEXT DEFAULT '{}'")
    _migrate_add_column(conn, "papers", "status", "TEXT DEFAULT 'to_read'")
    _migrate_add_column(conn, "qa_history", "follow_ups", "TEXT")
    _migrate_add_column(conn, "collections", "category", "TEXT DEFAULT ''")
    _migrate_add_column(conn, "collections", "color", "TEXT DEFAULT '#3525cd'")


def save_paper(paper: dict):
    conn = _conn()
    pid = paper.get("id") or paper.get("paper_id")
    conn.execute(
        """INSERT OR REPLACE INTO papers
           (paper_id, filename, metadata, executive_summary, detailed_summary,
            key_findings, key_elements, attribution_report, created_at, source_file, reading_progress, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            pid,
            paper["filename"],
            json.dumps(paper.get("metadata")) if paper.get("metadata") is not None else None,
            paper.get("executive_summary"),
            paper.get("detailed_summary"),
            paper.get("key_findings"),
            json.dumps(paper.get("key_elements")) if paper.get("key_elements") is not None else None,
            json.dumps(paper.get("attribution_report")) if paper.get("attribution_report") is not None else None,
            paper["created_at"],
            paper.get("source_file"),
            json.dumps(paper.get("reading_progress", {})),
            paper.get("status", "to_read"),
        ),
    )
    conn.commit()


def get_paper(paper_id: str) -> dict | None:
    conn = _conn()
    row = conn.execute("SELECT * FROM papers WHERE paper_id = ?", (paper_id,)).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def list_papers() -> list[dict]:
    conn = _conn()
    rows = conn.execute("SELECT * FROM papers ORDER BY created_at DESC").fetchall()
    return [_row_to_dict(r) for r in rows]


def delete_paper(paper_id: str) -> bool:
    conn = _conn()
    cur = conn.execute("DELETE FROM papers WHERE paper_id = ?", (paper_id,))
    conn.commit()
    return cur.rowcount > 0


def purge_expired(max_age_days: int = 30) -> list[str]:
    import time
    conn = _conn()
    cutoff = time.time() - (max_age_days * 86400)
    rows = conn.execute(
        "SELECT paper_id FROM papers WHERE created_at < ?", (cutoff,)
    ).fetchall()
    ids = [r["paper_id"] for r in rows]
    if ids:
        conn.execute(
            f"DELETE FROM papers WHERE paper_id IN ({','.join('?' * len(ids))})", ids
        )
        conn.commit()
    return ids


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if "paper_id" in d:
        d["id"] = d.pop("paper_id")
    for key in ("metadata", "key_elements", "attribution_report"):
        if d.get(key) is not None:
            d[key] = json.loads(d[key])
    if d.get("reading_progress") is not None:
        try:
            d["reading_progress"] = json.loads(d["reading_progress"])
        except (json.JSONDecodeError, TypeError):
            d["reading_progress"] = {}
    return d


def _migrate_add_column(conn: sqlite3.Connection, table: str, column: str, col_type: str):
    try:
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            conn.commit()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Last-viewed tracking
# ---------------------------------------------------------------------------

def touch_paper(paper_id: str):
    import time
    conn = _conn()
    conn.execute("UPDATE papers SET last_viewed = ? WHERE paper_id = ?", (time.time(), paper_id))
    conn.commit()


def list_papers_recent(limit: int = 50) -> list[dict]:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM papers WHERE last_viewed IS NOT NULL ORDER BY last_viewed DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_reading_reminders(days_threshold: int = 30) -> list[dict]:
    import time as _time
    conn = _conn()
    cutoff = _time.time() - (days_threshold * 86400)
    rows = conn.execute(
        """SELECT * FROM papers 
           WHERE status = 'to_read' AND (last_viewed IS NULL OR last_viewed < ?)
           ORDER BY created_at ASC""",
        (cutoff,),
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Tags (stored in metadata JSON as "tags" list)
# ---------------------------------------------------------------------------

def update_paper_tags(paper_id: str, tags: list[str]):
    import json as _json
    conn = _conn()
    row = conn.execute("SELECT metadata FROM papers WHERE paper_id = ?", (paper_id,)).fetchone()
    if row is None:
        return
    meta = _json.loads(row["metadata"]) if row["metadata"] else {}
    meta["tags"] = tags
    conn.execute("UPDATE papers SET metadata = ? WHERE paper_id = ?", (_json.dumps(meta), paper_id))
    conn.commit()


def search_papers(query: str) -> list[dict]:
    conn = _conn()
    q = f"%{query}%"
    rows = conn.execute(
        """SELECT * FROM papers
           WHERE filename LIKE ? OR executive_summary LIKE ? OR detailed_summary LIKE ?
              OR metadata LIKE ?
           ORDER BY created_at DESC""",
        (q, q, q, q),
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

import uuid as _uuid

def create_collection(name: str, description: str = "", category: str = "") -> dict:
    conn = _conn()
    cid = _uuid.uuid4().hex[:12]
    import time as _time
    conn.execute(
        "INSERT INTO collections (collection_id, name, description, category, created_at) VALUES (?, ?, ?, ?, ?)",
        (cid, name, description, category, _time.time()),
    )
    conn.commit()
    return {"id": cid, "name": name, "description": description, "category": category}


def list_collections() -> list[dict]:
    conn = _conn()
    rows = conn.execute("SELECT * FROM collections ORDER BY created_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["id"] = d.pop("collection_id")
        d.setdefault("category", "")
        count_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM collection_papers WHERE collection_id = ?",
            (d["id"],),
        ).fetchone()
        d["paper_count"] = count_row["cnt"] if count_row else 0
        result.append(d)
    return result


def get_collection(collection_id: str) -> dict | None:
    conn = _conn()
    row = conn.execute(
        "SELECT * FROM collections WHERE collection_id = ?", (collection_id,)
    ).fetchone()
    if row is None:
        return None
    d = dict(row)
    d["id"] = d.pop("collection_id")
    d.setdefault("category", "")
    paper_rows = conn.execute(
        """SELECT p.* FROM papers p
           JOIN collection_papers cp ON p.paper_id = cp.paper_id
           WHERE cp.collection_id = ?
           ORDER BY cp.added_at DESC""",
        (collection_id,),
    ).fetchall()
    d["papers"] = [_row_to_dict(r) for r in paper_rows]
    return d


def rename_collection(collection_id: str, name: str) -> bool:
    conn = _conn()
    cur = conn.execute(
        "UPDATE collections SET name = ? WHERE collection_id = ?", (name, collection_id)
    )
    conn.commit()
    return cur.rowcount > 0


def delete_collection(collection_id: str) -> bool:
    conn = _conn()
    conn.execute("DELETE FROM collection_papers WHERE collection_id = ?", (collection_id,))
    cur = conn.execute("DELETE FROM collections WHERE collection_id = ?", (collection_id,))
    conn.commit()
    return cur.rowcount > 0


def add_paper_to_collection(collection_id: str, paper_id: str) -> bool:
    import time as _time
    conn = _conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at) VALUES (?, ?, ?)",
            (collection_id, paper_id, _time.time()),
        )
        conn.commit()
        return True
    except Exception:
        return False


def remove_paper_from_collection(collection_id: str, paper_id: str) -> bool:
    conn = _conn()
    cur = conn.execute(
        "DELETE FROM collection_papers WHERE collection_id = ? AND paper_id = ?",
        (collection_id, paper_id),
    )
    conn.commit()
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

def add_note(paper_id: str, text: str, page_ref: int | None = None) -> dict:
    import time as _time
    conn = _conn()
    nid = _uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO notes (note_id, paper_id, text, page_ref, created_at) VALUES (?, ?, ?, ?, ?)",
        (nid, paper_id, text, page_ref, _time.time()),
    )
    conn.commit()
    return {"id": nid, "paper_id": paper_id, "text": text, "page_ref": page_ref}


def list_notes(paper_id: str) -> list[dict]:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM notes WHERE paper_id = ? ORDER BY created_at ASC", (paper_id,)
    ).fetchall()
    return [{"id": r["note_id"], "paper_id": r["paper_id"], "text": r["text"],
             "page_ref": r["page_ref"], "created_at": r["created_at"]} for r in rows]


def delete_note(note_id: str) -> bool:
    conn = _conn()
    cur = conn.execute("DELETE FROM notes WHERE note_id = ?", (note_id,))
    conn.commit()
    return cur.rowcount > 0


def update_note(note_id: str, text: str) -> bool:
    import time as _time
    conn = _conn()
    row = conn.execute("SELECT text FROM notes WHERE note_id = ?", (note_id,)).fetchone()
    if row is None:
        return False
    vid = _uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO note_versions (version_id, note_id, text, created_at) VALUES (?, ?, ?, ?)",
        (vid, note_id, row["text"], _time.time()),
    )
    cur = conn.execute("UPDATE notes SET text = ? WHERE note_id = ?", (text, note_id))
    conn.commit()
    return cur.rowcount > 0


def get_note_versions(note_id: str) -> list[dict]:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM note_versions WHERE note_id = ? ORDER BY created_at DESC", (note_id,)
    ).fetchall()
    return [{"id": r["version_id"], "note_id": r["note_id"], "text": r["text"],
             "created_at": r["created_at"]} for r in rows]


def revert_note(note_id: str, version_id: str) -> bool:
    import time as _time
    conn = _conn()
    vrow = conn.execute("SELECT text FROM note_versions WHERE version_id = ? AND note_id = ?",
                        (version_id, note_id)).fetchone()
    if vrow is None:
        return False
    nrow = conn.execute("SELECT text FROM notes WHERE note_id = ?", (note_id,)).fetchone()
    if nrow is None:
        return False
    vid = _uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO note_versions (version_id, note_id, text, created_at) VALUES (?, ?, ?, ?)",
        (vid, note_id, nrow["text"], _time.time()),
    )
    cur = conn.execute("UPDATE notes SET text = ? WHERE note_id = ?", (vrow["text"], note_id))
    conn.commit()
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Q&A History
# ---------------------------------------------------------------------------

def save_qa(paper_id: str, question: str, answer: str, sources: list[int] | None = None, follow_ups: list[str] | None = None):
    import time as _time
    import json as _json
    conn = _conn()
    qid = _uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO qa_history (qa_id, paper_id, question, answer, sources, follow_ups, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (qid, paper_id, question, answer, _json.dumps(sources or []), _json.dumps(follow_ups or []), _time.time()),
    )
    conn.commit()


def list_qa_history(paper_id: str) -> list[dict]:
    import json as _json
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM qa_history WHERE paper_id = ? ORDER BY created_at ASC", (paper_id,)
    ).fetchall()
    return [{"id": r["qa_id"], "paper_id": r["paper_id"], "question": r["question"],
             "answer": r["answer"], "sources": _json.loads(r["sources"]) if r["sources"] else [],
             "created_at": r["created_at"]} for r in rows]


def search_notes(query: str) -> list[dict]:
    conn = _conn()
    q = f"%{query}%"
    rows = conn.execute(
        """SELECT n.*, p.filename FROM notes n
           JOIN papers p ON n.paper_id = p.paper_id
           WHERE n.text LIKE ?
           ORDER BY n.created_at DESC LIMIT 20""",
        (q,),
    ).fetchall()
    return [{"id": r["note_id"], "paper_id": r["paper_id"], "text": r["text"],
             "page_ref": r["page_ref"], "paper_name": r["filename"],
             "created_at": r["created_at"]} for r in rows]


def search_qa(query: str) -> list[dict]:
    import json as _json
    conn = _conn()
    q = f"%{query}%"
    rows = conn.execute(
        """SELECT q.*, p.filename FROM qa_history q
           JOIN papers p ON q.paper_id = p.paper_id
           WHERE q.question LIKE ? OR q.answer LIKE ?
           ORDER BY q.created_at DESC LIMIT 20""",
        (q, q),
    ).fetchall()
    return [{"id": r["qa_id"], "paper_id": r["paper_id"], "question": r["question"],
             "answer": r["answer"], "paper_name": r["filename"],
             "created_at": r["created_at"]} for r in rows]


def clear_all_data():
    conn = _conn()
    conn.executescript("""
        DELETE FROM collection_papers;
        DELETE FROM collections;
        DELETE FROM notes;
        DELETE FROM qa_history;
        DELETE FROM papers;
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# Reading Progress
# ---------------------------------------------------------------------------

def update_reading_progress(paper_id: str, section: str):
    import json as _json
    conn = _conn()
    row = conn.execute("SELECT reading_progress FROM papers WHERE paper_id = ?", (paper_id,)).fetchone()
    if row is None:
        return
    progress = _json.loads(row["reading_progress"]) if row["reading_progress"] else {}
    progress[section] = True
    conn.execute("UPDATE papers SET reading_progress = ? WHERE paper_id = ?", (_json.dumps(progress), paper_id))
    conn.commit()


# ---------------------------------------------------------------------------
# Bulk Operations
# ---------------------------------------------------------------------------

def bulk_delete_papers(paper_ids: list[str]) -> int:
    conn = _conn()
    if not paper_ids:
        return 0
    placeholders = ",".join("?" * len(paper_ids))
    cur = conn.execute(f"DELETE FROM papers WHERE paper_id IN ({placeholders})", paper_ids)
    conn.commit()
    return cur.rowcount


def bulk_export_bibtex(paper_ids: list[str]) -> list[dict]:
    import json as _json
    conn = _conn()
    if not paper_ids:
        return []
    placeholders = ",".join("?" * len(paper_ids))
    rows = conn.execute(
        f"SELECT paper_id, metadata FROM papers WHERE paper_id IN ({placeholders})", paper_ids
    ).fetchall()
    results = []
    for r in rows:
        meta = _json.loads(r["metadata"]) if r["metadata"] else None
        if meta:
            results.append({"id": r["paper_id"], "metadata": meta})
    return results


def list_all_paper_ids() -> list[str]:
    conn = _conn()
    rows = conn.execute("SELECT paper_id FROM papers").fetchall()
    return [r["paper_id"] for r in rows]


def export_all_data() -> dict:
    import json as _json
    conn = _conn()
    
    # Get all papers
    paper_rows = conn.execute("SELECT * FROM papers ORDER BY created_at DESC").fetchall()
    papers = []
    for r in paper_rows:
        d = dict(r)
        if "paper_id" in d:
            d["id"] = d.pop("paper_id")
        for key in ("metadata", "key_elements", "attribution_report"):
            if d.get(key) is not None:
                d[key] = _json.loads(d[key])
        if d.get("reading_progress") is not None:
            try:
                d["reading_progress"] = _json.loads(d["reading_progress"])
            except (_json.JSONDecodeError, TypeError):
                d["reading_progress"] = {}
        papers.append(d)
    
    # Get all collections
    collection_rows = conn.execute("SELECT * FROM collections ORDER BY created_at DESC").fetchall()
    collections = []
    for r in collection_rows:
        d = dict(r)
        d["id"] = d.pop("collection_id")
        d.setdefault("category", "")
        papers_in_collection = conn.execute(
            """SELECT p.* FROM papers p
               JOIN collection_papers cp ON p.paper_id = cp.paper_id
               WHERE cp.collection_id = ?
               ORDER BY cp.added_at DESC""",
            (d["id"],),
        ).fetchall()
        d["paper_ids"] = [pr["paper_id"] for pr in papers_in_collection]
        collections.append(d)
    
    # Get all notes
    note_rows = conn.execute("SELECT * FROM notes ORDER BY created_at ASC").fetchall()
    notes = [{"id": r["note_id"], "paper_id": r["paper_id"], "text": r["text"],
              "page_ref": r["page_ref"], "created_at": r["created_at"]} for r in note_rows]
    
    # Get all Q&A history
    qa_rows = conn.execute("SELECT * FROM qa_history ORDER BY created_at ASC").fetchall()
    qa_history = [{"id": r["qa_id"], "paper_id": r["paper_id"], "question": r["question"],
                   "answer": r["answer"], "sources": _json.loads(r["sources"]) if r["sources"] else [],
                   "follow_ups": _json.loads(r["follow_ups"]) if r["follow_ups"] else [],
                   "created_at": r["created_at"]} for r in qa_rows]
    
    # Get all note versions
    version_rows = conn.execute("SELECT * FROM note_versions ORDER BY created_at DESC").fetchall()
    note_versions = [{"id": r["version_id"], "note_id": r["note_id"], "text": r["text"],
                      "created_at": r["created_at"]} for r in version_rows]
    
    # Get all activities
    activity_rows = conn.execute("SELECT * FROM activity_log ORDER BY created_at DESC").fetchall()
    activities = [{"id": r["activity_id"], "action": r["action"], "detail": r["detail"],
                   "paper_id": r["paper_id"], "created_at": r["created_at"]} for r in activity_rows]
    
    # Get all notifications
    notification_rows = conn.execute("SELECT * FROM notifications ORDER BY created_at DESC").fetchall()
    notifications = [{"id": r["notification_id"], "type": r["type"], "title": r["title"],
                      "message": r["message"], "paper_id": r["paper_id"], "read": bool(r["read"]),
                      "created_at": r["created_at"]} for r in notification_rows]
    
    return {
        "version": "1.0",
        "exported_at": __import__("time").time(),
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

def log_activity(action: str, detail: str = "", paper_id: str | None = None):
    import time as _time
    conn = _conn()
    aid = _uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO activity_log (activity_id, action, detail, paper_id, created_at) VALUES (?, ?, ?, ?, ?)",
        (aid, action, detail, paper_id, _time.time()),
    )
    conn.commit()


def list_activities(limit: int = 50) -> list[dict]:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    return [{"id": r["activity_id"], "action": r["action"], "detail": r["detail"],
             "paper_id": r["paper_id"], "created_at": r["created_at"]} for r in rows]


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

def add_notification(type_: str, title: str, message: str, paper_id: str | None = None):
    import time as _time
    conn = _conn()
    nid = _uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO notifications (notification_id, type, title, message, paper_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (nid, type_, title, message, paper_id, 0, _time.time()),
    )
    conn.commit()
    return {"id": nid, "type": type_, "title": title, "message": message, "paper_id": paper_id, "read": False, "created_at": _time.time()}


def list_notifications(limit: int = 50, unread_only: bool = False) -> list[dict]:
    conn = _conn()
    query = "SELECT * FROM notifications"
    params = []
    if unread_only:
        query += " WHERE read = 0"
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    return [{"id": r["notification_id"], "type": r["type"], "title": r["title"],
             "message": r["message"], "paper_id": r["paper_id"], "read": bool(r["read"]),
             "created_at": r["created_at"]} for r in rows]


def mark_notification_read(notification_id: str) -> bool:
    conn = _conn()
    cur = conn.execute("UPDATE notifications SET read = 1 WHERE notification_id = ?", (notification_id,))
    conn.commit()
    return cur.rowcount > 0


def mark_all_notifications_read() -> int:
    conn = _conn()
    cur = conn.execute("UPDATE notifications SET read = 1 WHERE read = 0")
    conn.commit()
    return cur.rowcount
