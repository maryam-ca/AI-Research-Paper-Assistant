"""Run once to create all tables. Usage: python init_db.py

If you prefer raw SQL, run db/schema.sql against your Neon database instead.
"""
import os
from dotenv import load_dotenv

_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
load_dotenv(_ENV_PATH)

from database import engine
from models import Base


def init_db():
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialized")


if __name__ == "__main__":
    init_db()
