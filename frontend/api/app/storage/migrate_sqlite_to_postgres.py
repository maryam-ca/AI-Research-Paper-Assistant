"""
Migration script: SQLite -> Neon Postgres
Run: python -m backend.app.storage.migrate_sqlite_to_postgres

Requires:
  - DATABASE_URL env var pointing to Neon Postgres
  - papers.db in backend/ directory
"""
import asyncio
import json
import os
import sqlite3
import time
from pathlib import Path

import asyncpg

DB_PATH = Path(__file__).resolve().parent.parent.parent / "papers.db"

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

CREATE TABLE IF NOT EXISTS paper_chunks (
    id          TEXT PRIMARY KEY,
    paper_id    TEXT NOT NULL,
    page        INTEGER,
    chunk_id    INTEGER,
    text        TEXT NOT NULL,
    embedding   vector(3072),
    created_at  DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper ON paper_chunks(paper_id);
"""


def sqlite_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for key in ("metadata", "key_elements", "attribution_report", "reading_progress", "sources", "follow_ups"):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return d


async def migrate():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("ERROR: Set DATABASE_URL env var")
        return

    if not DB_PATH.exists():
        print(f"ERROR: SQLite DB not found at {DB_PATH}")
        return

    sqlite_conn = sqlite3.connect(str(DB_PATH))
    sqlite_conn.row_factory = sqlite3.Row

    pg = await asyncpg.create_pool(dsn, min_size=1, max_size=5)
    async with pg.acquire() as conn:
        await conn.execute(SCHEMA)

        # Migrate papers
        papers = sqlite_conn.execute("SELECT * FROM papers").fetchall()
        for p in papers:
            d = sqlite_to_dict(p)
            meta = json.dumps(d.get("metadata")) if d.get("metadata") is not None else None
            ke = json.dumps(d.get("key_elements")) if d.get("key_elements") is not None else None
            ar = json.dumps(d.get("attribution_report")) if d.get("attribution_report") is not None else None
            rp = json.dumps(d.get("reading_progress", {}))
            await conn.execute(
                """INSERT INTO papers (paper_id, filename, metadata, executive_summary,
                   detailed_summary, key_findings, key_elements, attribution_report,
                   created_at, last_viewed, source_file, reading_progress, status)
                   VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb,$13)
                   ON CONFLICT (paper_id) DO NOTHING""",
                d["paper_id"], d["filename"], meta, d.get("executive_summary"),
                d.get("detailed_summary"), d.get("key_findings"), ke, ar,
                d["created_at"], d.get("last_viewed"), d.get("source_file"),
                rp, d.get("status", "to_read"),
            )
        print(f"Migrated {len(papers)} papers")

        # Migrate collections
        collections = sqlite_conn.execute("SELECT * FROM collections").fetchall()
        for c in collections:
            d = dict(c)
            await conn.execute(
                "INSERT INTO collections (collection_id, name, description, category, color, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
                d["collection_id"], d["name"], d.get("description", ""), d.get("category", ""), d.get("color", "#3525cd"), d["created_at"],
            )
        print(f"Migrated {len(collections)} collections")

        # Migrate collection_papers
        cps = sqlite_conn.execute("SELECT * FROM collection_papers").fetchall()
        for cp in cps:
            d = dict(cp)
            await conn.execute(
                "INSERT INTO collection_papers (collection_id, paper_id, added_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
                d["collection_id"], d["paper_id"], d["added_at"],
            )
        print(f"Migrated {len(cps)} collection_papers")

        # Migrate notes
        notes = sqlite_conn.execute("SELECT * FROM notes").fetchall()
        for n in notes:
            d = dict(n)
            await conn.execute(
                "INSERT INTO notes (note_id, paper_id, text, page_ref, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
                d["note_id"], d["paper_id"], d["text"], d.get("page_ref"), d["created_at"],
            )
        print(f"Migrated {len(notes)} notes")

        # Migrate note_versions
        nvs = sqlite_conn.execute("SELECT * FROM note_versions").fetchall()
        for nv in nvs:
            d = dict(nv)
            await conn.execute(
                "INSERT INTO note_versions (version_id, note_id, text, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
                d["version_id"], d["note_id"], d["text"], d["created_at"],
            )
        print(f"Migrated {len(nvs)} note_versions")

        # Migrate qa_history
        qas = sqlite_conn.execute("SELECT * FROM qa_history").fetchall()
        for q in qas:
            d = sqlite_to_dict(q)
            sources = json.dumps(d.get("sources")) if d.get("sources") is not None else "[]"
            follow_ups = json.dumps(d.get("follow_ups")) if d.get("follow_ups") is not None else "[]"
            await conn.execute(
                """INSERT INTO qa_history (qa_id, paper_id, question, answer, sources, follow_ups, created_at)
                   VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) ON CONFLICT DO NOTHING""",
                d["qa_id"], d["paper_id"], d["question"], d["answer"], sources, follow_ups, d["created_at"],
            )
        print(f"Migrated {len(qas)} qa_history")

        # Migrate activity_log
        als = sqlite_conn.execute("SELECT * FROM activity_log").fetchall()
        for al in als:
            d = dict(al)
            await conn.execute(
                "INSERT INTO activity_log (activity_id, action, detail, paper_id, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
                d["activity_id"], d["action"], d.get("detail", ""), d.get("paper_id"), d["created_at"],
            )
        print(f"Migrated {len(als)} activity_log")

        # Migrate notifications
        nots = sqlite_conn.execute("SELECT * FROM notifications").fetchall()
        for n in nots:
            d = dict(n)
            await conn.execute(
                "INSERT INTO notifications (notification_id, type, title, message, paper_id, read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
                d["notification_id"], d["type"], d["title"], d["message"], d.get("paper_id"), d.get("read", 0), d["created_at"],
            )
        print(f"Migrated {len(nots)} notifications")

    sqlite_conn.close()
    await pg.close()
    print("Migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
