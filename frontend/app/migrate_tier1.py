"""Tier 1 migration: add new columns to the existing `papers` table and create
the `highlights` table. Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
Run with the backend venv:  python migrate_tier1.py
"""
from app.database import engine
from sqlalchemy import text

STATEMENTS = [
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS reading_status VARCHAR(20) DEFAULT 'not_started'",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS started_reading_at TIMESTAMP",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS completed_reading_at TIMESTAMP",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS keywords TEXT[]",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS readability_score INT",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20)",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS page_count INT",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS reading_time_minutes INT",
    """
    CREATE TABLE IF NOT EXISTS highlights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        page_number INT,
        color VARCHAR(20) DEFAULT 'yellow',
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )
    """,
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
    print("Tier 1 migration applied successfully.")


if __name__ == "__main__":
    main()

