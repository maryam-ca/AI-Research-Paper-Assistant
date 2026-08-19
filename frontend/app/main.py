import os
from dotenv import load_dotenv

# Load .env.local from the frontend/ directory (parent of frontend/app/)
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
load_dotenv(_ENV_PATH)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import router

app = FastAPI(title="ScholarFlow API", version="1.0.0")

# CORS for local dev and production. Avoid wildcards with credentials.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://scholarflow.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS + ["https://*.vercel.app"],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Serve the built SPA (frontend/dist) as the fallback for non-API routes.
# Path operations (e.g. /api/...) always take precedence over frontend files.
_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
if os.path.isdir(_DIST):
    app.frontend("/", directory=_DIST, fallback="index.html")
