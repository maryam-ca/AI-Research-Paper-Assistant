import os
from pathlib import Path
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .middleware.rate_limiter import RateLimitMiddleware
from .api.routes import router as papers_router

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:8001",
    "http://localhost:8003",
    os.environ.get("FRONTEND_URL", ""),
]
# Add Vercel frontend URL if provided
vercel_frontend = os.environ.get("VERCEL_FRONTEND_URL", "")
if vercel_frontend:
    ALLOWED_ORIGINS.append(vercel_frontend)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from .storage import paper_store
        await paper_store.get_pool()
        from .storage.vector_store import get_pool as get_vec_pool
        await get_vec_pool()
        expired_ids = await paper_store.purge_expired(max_age_days=30)
        from .storage.vector_store import purge_expired
        await purge_expired(max_age_days=30)
    except Exception:
        pass
    yield


app = FastAPI(title="Research Paper Assistant API", lifespan=lifespan)

app.add_middleware(RateLimitMiddleware, max_papers=10, window=3600)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


app.include_router(papers_router)
