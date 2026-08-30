from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import RecoveryAction, RevenueEvent, ActionOutcome, Diagnosis
from app.services import audit_logger, recovery_policy

# ==============================================================================
# HUMAN REVIEW GATE POLICY CONFIGURATION
# ==============================================================================
# Threshold in paise: 1,000,000 paise = ₹10,000.00 INR.
# Deliberate Policy Rationale:
# 1. High-Value Safeguard (> ₹10,000): Transactions exceeding ₹10k represent
#    enterprise/high-value customer relationships. Autonomous bot interventions
#    carry higher brand/revenue risk if misdiagnosed.
# 2. Financial Concessions: Actions that reduce company gross margins (discounts,
#    waivers, refunds) require human commercial oversight before commitment.
# 3. Systemic Outages: Bank gateway outages or high-severity mandate failures
#    affect multiple payments simultaneously and warrant human incident command.
# ==============================================================================
HIGH_VALUE_THRESHOLD_PAISE = 1_000_000 # ₹10,000.00
CONCESSION_ACTION_TYPES = {'apply_discount', 'waiver', 'refund', 'offer_discount'}


def check_human_review_triggers(
    event: RevenueEvent,
    action: RecoveryAction,
    diagnosis: Diagnosis
) -> Tuple[bool, List[str]]:
    """
    Evaluates whether an action requires human review based on deliberate risk criteria.
    Returns (requires_review: bool, trigger_reasons: List[str]).
    """
    triggers = []

    # Criterion 1: High Transaction Value (> ₹10,000)
    if event.amount_at_risk > HIGH_VALUE_THRESHOLD_PAISE:
        triggers.append(f"High-value transaction: ₹{event.amount_at_risk / 100:,.2f} exceeds ₹10,000 threshold")

    # Criterion 2: Financial Concession / Discount
    if action.action_type in CONCESSION_ACTION_TYPES:
        triggers.append(f"Financial concession proposed: action '{action.action_type}' impacts margins")

    # Criterion 3: Systemic Incident Alert
    if getattr(diagnosis, 'is_systemic', False):
        triggers.append(f"Systemic alert: root cause '{diagnosis.root_cause}' flagged as systemic impact")

    return (len(triggers) > 0, triggers)


async def evaluate_human_review_gate(
    db: AsyncSession,
    action: RecoveryAction,
    event: RevenueEvent,
    diagnosis: Diagnosis
) -> RecoveryAction:
    """
    Evaluates the verifier human-in-the-loop gate before the executor runs.
    Routes high-risk actions to 'pending' human review; auto-approves low-risk actions.
    """
    requires_review, trigger_reasons = check_human_review_triggers(event, action, diagnosis)

    if requires_review:
        action.requires_human_review = True
        action.review_status = 'pending'
        event.status = 'pending_approval'

        await db.commit()
        await db.refresh(action)

        await audit_logger.log(db, event.id, 'human_review_required', {
            'action_id': action.id,
            'action_type': action.action_type,
            'amount_at_risk_paise': event.amount_at_risk,
            'amount_display': f"₹{event.amount_at_risk / 100:,.2f}",
            'is_systemic': getattr(diagnosis, 'is_systemic', False),
            'triggers': trigger_reasons
        })
    else:
        action.requires_human_review = False
        action.review_status = 'not_required'

        await db.commit()
        await db.refresh(action)

        await audit_logger.log(db, event.id, 'auto_approved', {
            'action_id': action.id,
            'action_type': action.action_type,
            'reason': "Low-risk transaction within autonomous execution thresholds"
        })

    return action


async def verify_action(
    db: AsyncSession,
    action: RecoveryAction,
    event: RevenueEvent,
    success: bool,
    amount_recovered: int = 0
) -> ActionOutcome:
    """
    Verifies the outcome of an executed recovery action and updates the multi-armed bandit.
    """
    outcome = ActionOutcome(
        action_id=action.id,
        event_id=event.id,
        success=success,
        amount_recovered=amount_recovered,
        verification_method="webhook" if success else "timeout",
        notes="Verified via telemetry verification engine"
    )
    db.add(outcome)

    action.status = 'verified_success' if success else 'verified_failure'
    if success:
        event.status = 'recovered'
    else:
        event.status = 'verified'
    
    await db.commit()
    await db.refresh(outcome)

    await recovery_policy.update_policy(db, event.event_type, action.action_type, success)

    await audit_logger.log(db, event.id, 'verified', {
        'action_id': action.id,
        'success': success,
        'amount_recovered': amount_recovered
    })

    return outcome
