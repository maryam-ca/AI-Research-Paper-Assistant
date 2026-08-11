import os
from typing import Optional
import asyncpg

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create database connection pool."""
    global _pool
    if _pool is None:
        dsn = os.environ.get("DATABASE_URL", "")
        if not dsn:
            raise ValueError("DATABASE_URL environment variable is not set")
        # Vercel Postgres/Neon requires SSL
        if "sslmode=" not in dsn:
            dsn += "&sslmode=require" if "?" in dsn else "?sslmode=require"
        _pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)
    return _pool


async def close_pool():
    """Close the database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None