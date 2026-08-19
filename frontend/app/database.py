import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# =========================================================
# ENVIRONMENT
# =========================================================

# frontend/
FRONTEND_DIR = Path(__file__).resolve().parent.parent

# Local environment file
ENV_FILE = FRONTEND_DIR / ".env.local"

# Load .env.local for local development.
# On Vercel, DATABASE_URL comes from Vercel Environment Variables.
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)


# =========================================================
# DATABASE URL
# =========================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Set DATABASE_URL in frontend/.env.local for local "
        "development or in Vercel Environment Variables "
        "for production."
    )


# =========================================================
# SQLALCHEMY BASE
# =========================================================

Base = declarative_base()


# =========================================================
# DATABASE ENGINE
# =========================================================

engine_kwargs = {
    "pool_pre_ping": True,
}


# Neon/PostgreSQL and local PostgreSQL
engine = create_engine(
    DATABASE_URL,
    **engine_kwargs,
)


# =========================================================
# SESSION
# =========================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# =========================================================
# FASTAPI DATABASE DEPENDENCY
# =========================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()