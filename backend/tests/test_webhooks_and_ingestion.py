import pytest
import json
import hmac
import hashlib
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import RevenueEvent, WebhookLog, Diagnosis, RecoveryAction
from app.config import settings


@pytest.mark.asyncio
async def test_webhook_payment_failed_ingestion(client: AsyncClient, db_session: AsyncSession):
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_failed_001",
                    "order_id": "order_test_failed_001",
                    "amount": 250000,
                    "currency": "INR",
                    "status": "failed",
                    "method": "card",
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_description": "Payment failed due to insufficient balance",
                    "error_source": "customer",
                    "error_step": "payment_authentication",
                    "error_reason": "insufficient_funds",
                    "email": "customer@enterprise.com",
                    "contact": "+919876543210"
                }
            }
        }
    }
    raw_json = json.dumps(payload)
    
    # Generate signature using active secret
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "test_secret"
    settings.RAZORPAY_WEBHOOK_SECRET = secret
    
    signature = hmac.new(
        key=secret.encode("utf-8"),
        msg=raw_json.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    response = await client.post(
        "/api/webhooks/razorpay",
        content=raw_json,
        headers={
            "Content-Type": "application/json",
            "x-razorpay-signature": signature
        }
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "ok"
    assert res_data["event"] == "payment.failed"

    # Verify Webhook log entry created
    log_stmt = select(WebhookLog).where(WebhookLog.event_type == "payment.failed")
    log_entry = (await db_session.execute(log_stmt)).scalars().first()
    assert log_entry is not None

    # Verify RevenueEvent created with diagnostic pipeline
    event_stmt = select(RevenueEvent).where(RevenueEvent.razorpay_entity_id == "pay_test_failed_001")
    event = (await db_session.execute(event_stmt)).scalars().first()
    assert event is not None
    assert event.amount_at_risk == 250000
    assert event.customer_email == "customer@enterprise.com"

    # Verify Diagnosis created
    diag_stmt = select(Diagnosis).where(Diagnosis.event_id == event.id)
    diag = (await db_session.execute(diag_stmt)).scalars().first()
    assert diag is not None
    assert diag.root_cause == "insufficient_funds"

    # Verify RecoveryAction created
    act_stmt = select(RecoveryAction).where(RecoveryAction.event_id == event.id)
    action = (await db_session.execute(act_stmt)).scalars().first()
    assert action is not None
    assert action.action_type in ["send_retry_link", "offer_alternate_method", "apply_discount", "send_reminder_email"]


@pytest.mark.asyncio
async def test_webhook_hmac_signature_verification_enforced(client: AsyncClient):
    original_secret = settings.RAZORPAY_WEBHOOK_SECRET
    settings.RAZORPAY_WEBHOOK_SECRET = "super_secret_webhook_key_123"
    
    payload = {"event": "payment.failed", "payload": {}}
    raw_json = json.dumps(payload)
    
    # 1. Test with invalid signature
    bad_res = await client.post(
        "/api/webhooks/razorpay",
        content=raw_json,
        headers={
            "Content-Type": "application/json",
            "x-razorpay-signature": "invalid_signature_hex"
        }
    )
    assert bad_res.status_code == 400
    
    # 2. Test with genuine HMAC signature
    valid_sig = hmac.new(
        key="super_secret_webhook_key_123".encode("utf-8"),
        msg=raw_json.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    good_res = await client.post(
        "/api/webhooks/razorpay",
        content=raw_json,
        headers={
            "Content-Type": "application/json",
            "x-razorpay-signature": valid_sig
        }
    )
    assert good_res.status_code == 200
    
    settings.RAZORPAY_WEBHOOK_SECRET = original_secret
