import asyncio
import logging
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import async_session_maker
from app.config import settings
from app.models import RevenueEvent, PollingState
from app.razorpay_client import razorpay_service
from app.services import event_ingester

logger = logging.getLogger(__name__)

# In-memory runtime state with DB persistence
_polling_interval_seconds = 60
_is_polling_active = True
_cycle_count = 0


async def get_or_create_polling_state(db: AsyncSession) -> PollingState:
    stmt = select(PollingState).order_by(PollingState.id.desc())
    res = await db.execute(stmt)
    state = res.scalars().first()
    if not state:
        state = PollingState(
            last_polled_at=datetime.now(timezone.utc),
            new_events_found=0,
            skipped_duplicates=0,
            interval_seconds=_polling_interval_seconds,
            last_summary=json.dumps({"initialized": True})
        )
        db.add(state)
        await db.commit()
        await db.refresh(state)
    return state


async def poll_razorpay_safety_net() -> Dict[str, Any]:
    """
    Executes a single polling cycle against Razorpay test-mode APIs.
    Enforces strict deduplication/idempotency against revenue_events.
    """
    global _cycle_count
    _cycle_count += 1
    cycle_start = datetime.now(timezone.utc)
    
    new_count = 0
    skipped_count = 0
    breakdown = {
        "payment_failures": {"new": 0, "skipped": 0},
        "checkout_abandons": {"new": 0, "skipped": 0},
        "receivables_overdue": {"new": 0, "skipped": 0}
    }

    async with async_session_maker() as db:
        try:
            # 1. Fetch Recent Payments (status = 'failed')
            recent_payments = razorpay_service.fetch_payments(count=20)
            for pay in recent_payments:
                if pay.get("status") == "failed":
                    pay_id = pay.get("id")
                    if not pay_id:
                        continue
                    
                    # Idempotency check: does this payment ID already exist in revenue_events?
                    stmt = select(RevenueEvent).where(
                        or_(
                            RevenueEvent.razorpay_object_id == pay_id,
                            RevenueEvent.razorpay_entity_id == pay_id
                        )
                    )
                    existing = (await db.execute(stmt)).scalars().first()
                    
                    if existing:
                        skipped_count += 1
                        breakdown["payment_failures"]["skipped"] += 1
                    else:
                        logger.info(f"[Polling Safety Net] Ingesting failed payment {pay_id} missed by webhook")
                        await event_ingester.ingest_webhook_event(db, "payment.failed", {
                            "event": "payment.failed",
                            "payload": {"payment": {"entity": pay}}
                        })
                        new_count += 1
                        breakdown["payment_failures"]["new"] += 1

            # 2. Fetch Recent Orders (unpaid & elapsed beyond abandonment threshold)
            recent_orders = razorpay_service.fetch_orders(count=20)
            now_ts = cycle_start.timestamp()
            threshold_seconds = settings.ABANDONMENT_THRESHOLD_MINUTES * 60

            for order in recent_orders:
                order_id = order.get("id")
                created_at = order.get("created_at", now_ts)
                status = order.get("status")
                notes = order.get("notes", {})

                is_unpaid = status in ("created", "attempted")
                is_elapsed = (now_ts - created_at) >= threshold_seconds
                is_scenario = isinstance(notes, dict) and notes.get("scenario") == "abandonment_test"

                if is_unpaid and (is_elapsed or is_scenario) and order_id:
                    stmt = select(RevenueEvent).where(
                        or_(
                            RevenueEvent.razorpay_object_id == order_id,
                            RevenueEvent.razorpay_order_id == order_id
                        )
                    )
                    existing = (await db.execute(stmt)).scalars().first()
                    
                    if existing:
                        skipped_count += 1
                        breakdown["checkout_abandons"]["skipped"] += 1
                    else:
                        logger.info(f"[Polling Safety Net] Ingesting abandoned order {order_id}")
                        await event_ingester.ingest_webhook_event(db, "checkout_abandoned", {
                            "event": "checkout_abandoned",
                            "payload": {"order": {"entity": order}}
                        })
                        new_count += 1
                        breakdown["checkout_abandons"]["new"] += 1

            # 3. Fetch Recent Invoices (status = 'expired' or 'cancelled')
            recent_invoices = razorpay_service.fetch_invoices(count=15)
            for inv in recent_invoices:
                inv_id = inv.get("id")
                status = inv.get("status")
                if status in ("expired", "cancelled") and inv_id:
                    stmt = select(RevenueEvent).where(
                        or_(
                            RevenueEvent.razorpay_object_id == inv_id,
                            RevenueEvent.razorpay_entity_id == inv_id
                        )
                    )
                    existing = (await db.execute(stmt)).scalars().first()
                    
                    if existing:
                        skipped_count += 1
                        breakdown["receivables_overdue"]["skipped"] += 1
                    else:
                        logger.info(f"[Polling Safety Net] Ingesting expired invoice {inv_id}")
                        await event_ingester.ingest_webhook_event(db, "invoice.expired", {
                            "event": "invoice.expired",
                            "payload": {"invoice": {"entity": inv}}
                        })
                        new_count += 1
                        breakdown["receivables_overdue"]["new"] += 1

            # 4. Persist Polling State in DB
            state = await get_or_create_polling_state(db)
            state.last_polled_at = cycle_start
            state.new_events_found = new_count
            state.skipped_duplicates = skipped_count
            state.interval_seconds = _polling_interval_seconds
            state.last_summary = json.dumps({
                "cycle": _cycle_count,
                "timestamp": cycle_start.isoformat(),
                "new_events": new_count,
                "skipped_duplicates": skipped_count,
                "breakdown": breakdown
            })
            await db.commit()

            logger.info(
                f"[Polling Safety Net Cycle #{_cycle_count}] New events ingested: {new_count} | "
                f"Skipped duplicates (already captured by webhook): {skipped_count}"
            )

        except Exception as e:
            logger.error(f"Error in polling safety net execution: {e}")

    return {
        "cycle": _cycle_count,
        "last_polled_at": cycle_start.isoformat(),
        "new_events": new_count,
        "skipped_duplicates": skipped_count,
        "breakdown": breakdown
    }


async def start_polling_worker():
    """
    Continuous background loop running the polling safety net.
    Runs concurrently with the webhook receiver at all times.
    """
    logger.info(f"Starting Razorpay Polling Safety Net background worker (interval: {_polling_interval_seconds}s)...")
    while True:
        try:
            if _is_polling_active:
                await poll_razorpay_safety_net()
        except Exception as e:
            logger.error(f"Unhandled exception in polling safety net loop: {e}")
        await asyncio.sleep(_polling_interval_seconds)


def set_polling_interval(seconds: int):
    """Dynamically modifies the polling interval for testing."""
    global _polling_interval_seconds
    _polling_interval_seconds = max(5, seconds)
    logger.info(f"Updated Polling Safety Net interval to {_polling_interval_seconds}s")
    return _polling_interval_seconds


def get_polling_worker_status() -> Dict[str, Any]:
    """Synchronous status overview for health probes."""
    return {
        "active": _is_polling_active,
        "interval_seconds": _polling_interval_seconds,
        "completed_cycles": _cycle_count,
    }


async def get_current_polling_status() -> Dict[str, Any]:
    """Returns the live polling safety net status from database and memory."""
    async with async_session_maker() as db:
        state = await get_or_create_polling_state(db)
        summary = {}
        try:
            if state.last_summary:
                summary = json.loads(state.last_summary)
        except Exception:
            pass

        return {
            "is_running": _is_polling_active,
            "interval_seconds": _polling_interval_seconds,
            "last_polled_at": state.last_polled_at.isoformat() if state.last_polled_at else None,
            "new_events_found_last_cycle": state.new_events_found,
            "skipped_duplicates_last_cycle": state.skipped_duplicates,
            "total_cycles_completed": _cycle_count,
            "last_cycle_summary": summary
        }

