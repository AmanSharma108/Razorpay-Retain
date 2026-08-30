from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import json
import logging

from app.database import get_db
from app.models import WebhookLog, RevenueEvent, RecoveryAction
from app.razorpay_client import razorpay_service
from app.services import event_ingester, verifier

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/webhooks/razorpay")
@router.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body_bytes = await request.body()
    body_str = body_bytes.decode('utf-8', errors='replace')
    signature = request.headers.get("x-razorpay-signature", "")
    
    # 1. Verify HMAC Signature
    is_verified = razorpay_service.verify_webhook_signature(body_str, signature)
    
    try:
        payload = json.loads(body_str) if body_str else {}
    except Exception:
        payload = {"raw": body_str}
        
    event_name = payload.get('event', 'unknown')

    # 2. Log raw webhook payload to webhook_logs table
    log_entry = WebhookLog(
        event_type=event_name,
        payload=body_str,
        received_at=datetime.now(timezone.utc),
        verified=is_verified
    )
    db.add(log_entry)
    await db.commit()

    if not is_verified:
        logger.warning(f"Rejected unverified webhook request with signature: {signature}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Razorpay webhook signature"
        )

    # 3. Handle specific Razorpay webhook events
    if event_name in ('payment.failed', 'order.payment_failed', 'subscription.charged.failed', 'invoice.expired', 'subscription.halted'):
        await event_ingester.ingest_webhook_event(db, event_name, payload)

    elif event_name in ('payment.captured', 'order.paid'):
        # Check if this captured payment/order was previously flagged as at-risk
        entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        order_id = entity.get('order_id')
        payment_id = entity.get('id')
        amount = entity.get('amount', 0)

        if order_id or payment_id:
            stmt = select(RevenueEvent).where(
                (RevenueEvent.razorpay_order_id == order_id) | (RevenueEvent.razorpay_entity_id == payment_id)
            ).order_by(RevenueEvent.id.desc())
            res = await db.execute(stmt)
            event = res.scalars().first()

            if event and event.status not in ('recovered',):
                # Fetch associated action
                action_stmt = select(RecoveryAction).where(
                    RecoveryAction.event_id == event.id
                ).order_by(RecoveryAction.id.desc())
                action_res = await db.execute(action_stmt)
                action = action_res.scalars().first()

                if action:
                    logger.info(f"Verified recovery reward for Event #{event.id} from real webhook {event_name}")
                    await verifier.verify_action(db, action, event, success=True, amount_recovered=amount or event.amount_at_risk)

    return {"status": "ok", "event": event_name, "verified": is_verified}
