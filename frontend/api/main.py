import os
from dotenv import load_dotenv

# Load .env.local from the frontend/ directory (parent of frontend/api/)
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
load_dotenv(_ENV_PATH)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

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


@app.get("/")
def root():
    return {"service": "ScholarFlow API", "docs": "/docs"}


handler = Mangum(app)
