import time
import uuid
import logging
from typing import Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.status import HTTP_429_TOO_MANY_REQUESTS
from app.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies enterprise-grade security headers compliant with OWASP recommendations.
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        # In production HTTPS environments, enforce HSTS
        if request.url.scheme == "https" or settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
            
        return response


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """
    Attaches unique correlation ID (X-Request-ID) and processing latency timer (X-Process-Time-Ms).
    """
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        start_time = time.perf_counter()
        response: Response = await call_next(request)
        process_time_ms = (time.perf_counter() - start_time) * 1000
        
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}"
        
        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding window in-memory rate limiter per client IP.
    Protects against aggressive scraping and denial of service.
    """
    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        # Mapping: ip -> (count, window_start_time)
        self._clients: Dict[str, Tuple[int, float]] = {}

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "127.0.0.1"

    async def dispatch(self, request: Request, call_next):
        # Exempt health checks and documentation endpoints from rate limiting
        path = request.url.path
        if path.startswith(("/health", "/healthz", "/ready", "/docs", "/redoc", "/openapi.json")):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        now = time.time()

        if client_ip in self._clients:
            count, window_start = self._clients[client_ip]
            if now - window_start < 60:
                if count >= self.requests_per_minute:
                    retry_after = int(60 - (now - window_start))
                    logger.warning(f"Rate limit exceeded for IP {client_ip} on {path}")
                    return JSONResponse(
                        status_code=HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "error": {
                                "code": "RATE_LIMIT_EXCEEDED",
                                "message": "Too many requests. Please slow down and try again later.",
                                "retry_after_seconds": max(1, retry_after)
                            }
                        },
                        headers={"Retry-After": str(max(1, retry_after))}
                    )
                self._clients[client_ip] = (count + 1, window_start)
            else:
                self._clients[client_ip] = (1, now)
        else:
            self._clients[client_ip] = (1, now)

        # Periodically clean up stale client entries
        if len(self._clients) > 10000:
            stale_keys = [k for k, (_, w_start) in self._clients.items() if now - w_start > 120]
            for k in stale_keys:
                self._clients.pop(k, None)

        return await call_next(request)
