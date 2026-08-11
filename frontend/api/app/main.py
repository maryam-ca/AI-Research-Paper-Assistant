import os
from pathlib import Path
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from frontend/api directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .middleware.rate_limiter import RateLimitMiddleware
from .api.routes import router as papers_router

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8080",
    os.environ.get("FRONTEND_URL", ""),
]
# Add Vercel frontend URL
vercel_frontend = os.environ.get("VERCEL_FRONTEND_URL", "")
if vercel_frontend:
    ALLOWED_ORIGINS.append(vercel_frontend)
# Allow all Vercel preview URLs
vercel_url = os.environ.get("VERCEL_URL", "")
if vercel_url:
    ALLOWED_ORIGINS.append(f"https://{vercel_url}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Skip DB initialization on cold starts for serverless
    yield


app = FastAPI(title="Research Paper Assistant API", lifespan=lifespan)

app.add_middleware(RateLimitMiddleware, max_papers=10, window=3600)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


app.include_router(papers_router)
