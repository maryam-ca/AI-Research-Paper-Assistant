import os
import sys
from pathlib import Path

# Add the current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from mangum import Mangum
from app.main import app

handler = Mangum(app, lifespan="off")