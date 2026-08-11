import os
import time

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
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            try:
                from upstash_redis import AsyncRedis
                self._redis = AsyncRedis(
                    url=os.environ.get("UPSTASH_REDIS_REST_URL", ""),
                    token=os.environ.get("UPSTASH_REDIS_REST_TOKEN", ""),
                )
            except Exception:
                return None
        return self._redis

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("POST",):
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api/papers"):
            return await call_next(request)

        if not (path.endswith("/upload") or path.endswith("/fetch")):
            return await call_next(request)

        ip = self._client_ip(request)
        redis = await self._get_redis()

        if redis is None:
            return await call_next(request)

        key = f"rate_limit:{ip}"
        now = time.time()

        try:
            await redis.zremrangebyscore(key, 0, now - self.window)
            count = await redis.zcard(key)
            if count >= self.max_papers:
                retry_after = int(self.window)
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Rate limit exceeded. Try again in {retry_after}s."},
                    headers={"Retry-After": str(retry_after)},
                )
        except Exception:
            pass

        response = await call_next(request)
        if response.status_code in (200, 201):
            try:
                await redis.zadd(key, {str(now): now})
                await redis.expire(key, self.window)
            except Exception:
                pass
        return response
