import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import RevenueEvent, Diagnosis, RecoveryAction, PolicyStats
from app.services.recovery_policy import ThompsonSamplingPolicy, policy_orchestrator, update_policy
from app.services.actor import executor_registry


@pytest.mark.asyncio
async def test_thompson_sampling_action_selection(db_session: AsyncSession):
    event = RevenueEvent(
        event_type="payment_failed",
        razorpay_entity_id="pay_test_bandit_001",
        amount_at_risk=50000,
        currency="INR",
        raw_payload="{}"
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    diagnosis = Diagnosis(
        event_id=event.id,
        root_cause="invalid_otp",
        severity=4,
        confidence=0.92,
        recommended_actions='["send_retry_link", "offer_alternate_method"]',
        reasoning="Test diagnosis for OTP error"
    )
    db_session.add(diagnosis)
    await db_session.commit()
    await db_session.refresh(diagnosis)

    policy = ThompsonSamplingPolicy()
    selected_action, explainability = await policy.select_action(
        db_session, event, diagnosis, ["send_retry_link", "offer_alternate_method"]
    )

    assert selected_action in ["send_retry_link", "offer_alternate_method"]
    assert "rationale" in explainability
    assert explainability["policy"] == "thompson_sampling"
    assert "candidate_posteriors" in explainability


@pytest.mark.asyncio
async def test_bandit_posterior_learning_update(db_session: AsyncSession):
    event_type = "payment_failed"
    action_type = "send_retry_link"

    # Reward successful recovery
    await update_policy(db_session, event_type, action_type, success=True)

    stmt = select(PolicyStats).where(
        PolicyStats.event_type == event_type,
        PolicyStats.action_type == action_type
    )
    stats = (await db_session.execute(stmt)).scalar_one_or_none()
    assert stats is not None
    assert stats.alpha == 2.0  # Initial 1.0 + 1.0 reward
    assert stats.total_successes == 1
    assert stats.total_attempts == 1

    # Penalize failed recovery
    await update_policy(db_session, event_type, action_type, success=False)
    await db_session.refresh(stats)
    assert stats.beta_param == 2.0  # Initial 1.0 + 1.0 penalty
    assert stats.total_attempts == 2


@pytest.mark.asyncio
async def test_action_executor_registry(db_session: AsyncSession):
    event = RevenueEvent(
        event_type="payment_failed",
        razorpay_entity_id="pay_test_exec_001",
        amount_at_risk=45000,
        currency="INR",
        raw_payload="{}"
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    action = RecoveryAction(
        event_id=event.id,
        diagnosis_id=1,
        action_type="send_retry_link",
        action_params="{}",
        status="pending",
        review_status="not_required"
    )
    db_session.add(action)
    await db_session.commit()
    await db_session.refresh(action)

    executed_action = await executor_registry.execute(db_session, action, event)
    assert executed_action.status == "executed"
    assert executed_action.result_details is not None
    assert "retry" in executed_action.result_details.lower()
