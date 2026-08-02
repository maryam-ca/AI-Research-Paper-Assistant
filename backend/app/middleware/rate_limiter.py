import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

MAX_PAPERS_PER_WINDOW = 10
WINDOW_SECONDS = 3600


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_papers: int = MAX_PAPERS_PER_WINDOW, window: int = WINDOW_SECONDS):
        super().__init__(app)
        self.max_papers = max_papers
        self.window = window
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup(self, ip: str, now: float) -> None:
        self._hits[ip] = [t for t in self._hits[ip] if now - t < self.window]

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("POST",):
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api/papers"):
            return await call_next(request)

        if not (path.endswith("/upload") or path.endswith("/fetch")):
            return await call_next(request)

        ip = self._client_ip(request)
        now = time.time()
        self._cleanup(ip, now)

        if len(self._hits[ip]) >= self.max_papers:
            retry_after = int(self.window - (now - self._hits[ip][0]))
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. Try again in {retry_after}s."},
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        if response.status_code in (200, 201):
            self._hits[ip].append(now)
        return response
