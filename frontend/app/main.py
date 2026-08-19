import os
import mimetypes

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes import router


# ---------------------------------------------------------
# Environment
# ---------------------------------------------------------

# Load local .env.local during local development.
# On Vercel, environment variables come from Vercel Settings.

_FRONTEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PATH = os.path.join(_FRONTEND, ".env.local")

load_dotenv(_ENV_PATH)


# ---------------------------------------------------------
# MIME Types
# ---------------------------------------------------------

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("font/woff2", ".woff2")


# ---------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------

app = FastAPI(
    title="ScholarFlow API",
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://scholarflow.vercel.app",
    "https://ai-research-paper-assistant-v1.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# API Routes
# ---------------------------------------------------------

app.include_router(router)


# ---------------------------------------------------------
# Root API Endpoint
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "ScholarFlow API",
        "status": "running",
        "docs": "/docs",
    }


# ---------------------------------------------------------
# Serve React Frontend
# ---------------------------------------------------------

_DIST = os.path.join(_FRONTEND, "dist")

if os.path.isdir(_DIST):
    app.mount(
        "/",
        StaticFiles(directory=_DIST, html=True),
        name="frontend",
    )


# ---------------------------------------------------------
# Vercel / Mangum Handler
# ---------------------------------------------------------

from mangum import Mangum

handler = Mangum(app)
