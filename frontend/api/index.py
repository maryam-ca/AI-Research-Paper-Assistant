import os
import sys

_FRONTEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_APP = os.path.join(_FRONTEND, "app")

# Make the absolute sibling imports inside app/ (e.g. `from routes import router`,
# `from database import ...`) resolvable regardless of how the function runs.
sys.path.insert(0, _APP)
sys.path.insert(0, _FRONTEND)
os.chdir(_FRONTEND)

import main
from mangum import Mangum

# Vercel's @vercel/python builder calls `handler(event, context)`.
handler = Mangum(main.app)