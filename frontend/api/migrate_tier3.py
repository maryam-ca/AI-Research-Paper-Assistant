"""Tier 3 migration: research_questions table + reproducibility/quality_flags columns.
Run with backend venv:  python migrate_tier3.py
"""
from database import engine
from sqlalchemy import text

STATEMENTS = [
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS reproducibility_score INT",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS quality_flags TEXT[]",
    """
    CREATE TABLE IF NOT EXISTS research_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        hypothesis TEXT,
        status VARCHAR(20) DEFAULT 'active',
        paper_ids TEXT[],
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
    print("Tier 3 migration applied successfully.")


if __name__ == "__main__":
    main()
