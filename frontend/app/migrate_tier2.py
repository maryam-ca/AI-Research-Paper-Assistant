"""Tier 2 migration: add rigor_score and bias_risk columns to papers.
Run with backend venv:  python migrate_tier2.py
"""
from app.database import engine
from sqlalchemy import text

STATEMENTS = [
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS rigor_score INT",
    "ALTER TABLE papers ADD COLUMN IF NOT EXISTS bias_risk VARCHAR(20)",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
    print("Tier 2 migration applied successfully.")


if __name__ == "__main__":
    main()

