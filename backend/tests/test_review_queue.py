import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import RevenueEvent, Diagnosis, RecoveryAction


@pytest.mark.asyncio
async def test_human_review_approval_flow(client: AsyncClient, db_session: AsyncSession):
    # Setup high-value event requiring review
    event = RevenueEvent(
        event_type="payment_failed",
        razorpay_entity_id="pay_high_value_999",
        amount_at_risk=2500000,  # ₹25,000 > ₹10,000 threshold
        currency="INR",
        raw_payload="{}"
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    diagnosis = Diagnosis(
        event_id=event.id,
        root_cause="issuer_decline",
        severity=5,
        confidence=0.95,
        recommended_actions='["apply_discount"]',
        reasoning="High value VIP transaction failure"
    )
    db_session.add(diagnosis)
    await db_session.commit()
    await db_session.refresh(diagnosis)

    action = RecoveryAction(
        event_id=event.id,
        diagnosis_id=diagnosis.id,
        action_type="apply_discount",
        action_params="{}",
        status="pending",
        requires_human_review=True,
        review_status="pending"
    )
    db_session.add(action)
    await db_session.commit()
    await db_session.refresh(action)

    # 1. Fetch Review Queue via API
    queue_res = await client.get("/api/review-queue")
    assert queue_res.status_code == 200
    queue_data = queue_res.json()
    assert len(queue_data) >= 1
    assert any(item["id"] == action.id for item in queue_data)

    # 2. Check pending count
    count_res = await client.get("/api/review-queue/count")
    assert count_res.status_code == 200
    assert count_res.json()["count"] >= 1

    # 3. Approve the action
    approve_res = await client.post(
        f"/api/review/{action.id}/approve",
        json={"reviewed_by": "RiskLead_Alice", "review_reason": "Approved 10% concession for VIP account"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["review_status"] == "approved"

    # Verify action status transitioned to executed after approval
    await db_session.refresh(action)
    assert action.review_status == "approved"
    assert action.status == "executed"
    assert action.reviewed_by == "RiskLead_Alice"


@pytest.mark.asyncio
async def test_human_review_rejection_flow(client: AsyncClient, db_session: AsyncSession):
    event = RevenueEvent(
        event_type="payment_failed",
        amount_at_risk=5000000,
        currency="INR",
        raw_payload="{}"
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    diagnosis = Diagnosis(
        event_id=event.id,
        root_cause="systemic_outage",
        severity=5,
        confidence=0.98,
        recommended_actions='["apply_discount"]',
        reasoning="Systemic gateway issue"
    )
    db_session.add(diagnosis)
    await db_session.commit()
    await db_session.refresh(diagnosis)

    action = RecoveryAction(
        event_id=event.id,
        diagnosis_id=diagnosis.id,
        action_type="apply_discount",
        action_params="{}",
        status="pending",
        requires_human_review=True,
        review_status="pending"
    )
    db_session.add(action)
    await db_session.commit()
    await db_session.refresh(action)

    # Reject the action with mandatory reason
    reject_res = await client.post(
        f"/api/review/{action.id}/reject",
        json={"reviewed_by": "RiskLead_Bob", "review_reason": "Discount policy not applicable for gateway outages"}
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["review_status"] == "rejected"

    await db_session.refresh(action)
    assert action.review_status == "rejected"
    assert action.status == "rejected"
    assert action.reviewed_by == "RiskLead_Bob"
