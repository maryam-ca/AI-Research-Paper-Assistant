import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .middleware.rate_limiter import RateLimitMiddleware
from .api.routes import router as papers_router

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.environ.get("FRONTEND_URL", ""),
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    from .storage.vector_store import purge_expired
    purge_expired(max_age_days=30)
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
