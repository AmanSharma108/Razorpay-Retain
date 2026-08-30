import time
import os
import sys
from datetime import datetime, timezone
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import ping_db
from app.razorpay_client import razorpay_service
from app.workers.polling_fallback import get_polling_worker_status

router = APIRouter(tags=["health"])

_START_TIME = time.time()


@router.get("/health")
@router.get("/api/health")
@router.get("/healthz")
@router.get("/ready")
async def health_check():
    """
    Comprehensive system health probe.
    Returns HTTP 200 when healthy, HTTP 503 if any critical subsystem fails.
    """
    uptime_seconds = int(time.time() - _START_TIME)
    
    # 1. Check Database connection & latency
    db_status = await ping_db()
    is_db_healthy = db_status.get("status") == "connected"
    
    # 2. Check Razorpay integration configuration
    razorpay_healthy = razorpay_service.client is not None
    razorpay_configured = (
        bool(settings.RAZORPAY_KEY_ID) and 
        not settings.RAZORPAY_KEY_ID.startswith("rzp_test_XXXX")
    )
    
    # 3. Check Polling Worker status
    polling_info = get_polling_worker_status()
    
    # Determine overall status
    overall_status = "healthy" if is_db_healthy else "unhealthy"
    status_code = status.HTTP_200_OK if is_db_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": overall_status,
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": uptime_seconds,
        "components": {
            "database": db_status,
            "razorpay_gateway": {
                "status": "ready" if razorpay_healthy else "degraded",
                "mode": "live_test_api" if razorpay_configured else "mock_sandbox",
                "webhook_verification": "enforced" if settings.RAZORPAY_WEBHOOK_SECRET else "sandbox_permissive"
            },
            "polling_worker": polling_info,
        },
        "system": {
            "python_version": sys.version.split()[0],
            "pid": os.getpid(),
        }
    }
    
    return JSONResponse(status_code=status_code, content=payload)


@router.get("/live")
async def liveness_probe():
    """Lightweight Kubernetes liveness probe."""
    return {"status": "alive"}
