from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.workers.polling_fallback import (
    get_current_polling_status, 
    set_polling_interval, 
    poll_razorpay_safety_net
)

router = APIRouter(prefix="/api/polling", tags=["polling"])


class SetIntervalRequest(BaseModel):
    interval_seconds: int = Field(default=60, ge=5, le=3600)


@router.get("/status")
async def get_polling_status():
    """Returns the live status of the Razorpay polling safety net."""
    return await get_current_polling_status()


@router.post("/interval")
async def update_polling_interval(body: SetIntervalRequest):
    """Updates the background polling interval in seconds."""
    new_interval = set_polling_interval(body.interval_seconds)
    return {
        "status": "updated",
        "interval_seconds": new_interval
    }


@router.post("/trigger")
async def trigger_immediate_poll():
    """Forces an immediate polling cycle against Razorpay test APIs."""
    result = await poll_razorpay_safety_net()
    return {
        "status": "completed",
        "result": result
    }
