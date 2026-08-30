import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.database import init_db
from app.config import settings
from app.workers.polling_fallback import start_polling_worker
from app.middleware.security import (
    SecurityHeadersMiddleware,
    RequestTracingMiddleware,
    RateLimiterMiddleware,
)
from app.routers import (
    health,
    webhooks,
    events,
    dashboard,
    recovery,
    audit,
    review,
    polling,
    checkout,
)

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("razorpay_retain")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Razorpay Retain database schema and indices...")
    await init_db()
    logger.info("Starting Polling Safety Net background worker for live gateway events...")
    polling_task = asyncio.create_task(start_polling_worker())
    
    yield
    
    # Graceful Shutdown
    logger.info("Shutting down Razorpay Retain workers...")
    polling_task.cancel()
    try:
        await polling_task
    except asyncio.CancelledError:
        logger.info("Polling worker gracefully stopped.")
    except Exception as e:
        logger.error(f"Error during polling worker shutdown: {e}")


# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
    lifespan=lifespan,
)

# Add Security & Tracing Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestTracingMiddleware)
app.add_middleware(
    RateLimiterMiddleware,
    requests_per_minute=settings.RATE_LIMIT_PER_MINUTE,
)

# CORS Middleware configuration
cors_origins = (
    settings.CORS_ORIGINS 
    if isinstance(settings.CORS_ORIGINS, list) 
    else [settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173", "*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
)


# Global Exception Handlers for Structured Production Responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "request_id": request_id,
            }
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload structure.",
                "details": exc.errors(),
                "request_id": request_id,
            }
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(f"Unhandled server error [Request-ID: {request_id}]: {exc}")
    
    # Hide internal details in production
    message = (
        str(exc) 
        if settings.ENVIRONMENT != "production" 
        else "An internal server error occurred. Our engineering team has been notified."
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": message,
                "request_id": request_id,
            }
        },
        headers={"X-Request-ID": request_id},
    )


# Include Live Production Application Routers
app.include_router(health.router)
app.include_router(webhooks.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(recovery.router)
app.include_router(audit.router)
app.include_router(review.router)
app.include_router(polling.router)
app.include_router(checkout.router)


@app.get("/")
async def root():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "mode": "live_realtime_gateway",
        "health": "/health",
        "docs": "/docs" if settings.ENABLE_DOCS else "disabled",
    }


