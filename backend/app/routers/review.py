from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import RecoveryAction, RevenueEvent, Diagnosis
from app.schemas import (
    ReviewQueueItem,
    ReviewDecisionRequest,
    ReviewRejectRequest,
    ReviewQueueCount,
    RecoveryActionOut
)
from app.services import actor, audit_logger, verifier

router = APIRouter(tags=["review"])

def utcnow():
    return datetime.now(timezone.utc)


@router.get("/api/review-queue", response_model=List[ReviewQueueItem])
async def get_review_queue(db: AsyncSession = Depends(get_db)):
    """
    Returns all recovery action proposals currently sitting in the 'pending' human review queue.
    Includes rich context: transaction value, failure cause, systemic alert status, and actor justification.
    """
    stmt = (
        select(RecoveryAction)
        .options(
            selectinload(RecoveryAction.event),
            selectinload(RecoveryAction.diagnosis),
            selectinload(RecoveryAction.outcome)
        )
        .where(RecoveryAction.review_status == 'pending')
        .order_by(desc(RecoveryAction.created_at))
    )
    result = await db.execute(stmt)
    actions = result.scalars().all()

    queue_items = []
    for act in actions:
        evt = act.event
        diag = act.diagnosis

        # Compute human review triggers
        _, triggers = verifier.check_human_review_triggers(evt, act, diag)

        queue_items.append(ReviewQueueItem(
            id=act.id,
            event_id=evt.id,
            entity_id=evt.razorpay_entity_id or evt.razorpay_order_id,
            loss_type=evt.event_type,
            amount_at_risk=evt.amount_at_risk,
            amount_display=f"₹{evt.amount_at_risk / 100:,.2f}",
            diagnosis_category=diag.root_cause if diag else "unknown",
            severity=diag.severity if diag else 1,
            confidence=diag.confidence if diag else 0.5,
            is_systemic=getattr(diag, 'is_systemic', False) if diag else False,
            proposed_action=act.action_type,
            actor_justification=diag.reasoning if diag else "Automated Thompson Sampling selection",
            customer_email=evt.customer_email,
            customer_contact=evt.customer_contact,
            review_status=act.review_status,
            requires_human_review=act.requires_human_review,
            review_trigger_reasons=triggers,
            created_at=act.created_at
        ))

    return queue_items


@router.get("/api/review-queue/count", response_model=ReviewQueueCount)
async def get_review_queue_count(db: AsyncSession = Depends(get_db)):
    """
    Returns the real-time count of pending human review proposals for sidebar badges and notifications.
    """
    stmt = select(func.count(RecoveryAction.id)).where(RecoveryAction.review_status == 'pending')
    count = await db.scalar(stmt) or 0
    return ReviewQueueCount(count=count)


@router.post("/api/review/{action_id}/approve", response_model=RecoveryActionOut)
async def approve_recovery_action(
    action_id: int,
    req: ReviewDecisionRequest = Body(default_factory=ReviewDecisionRequest),
    db: AsyncSession = Depends(get_db)
):
    """
    Human Approves Proposal:
    1. Sets review_status = 'approved', logs reviewer and timestamp.
    2. Emits 'human_approved' audit trail entry.
    3. Triggers the polymorphic recovery executor immediately.
    """
    stmt = (
        select(RecoveryAction)
        .options(
            selectinload(RecoveryAction.event),
            selectinload(RecoveryAction.diagnosis),
            selectinload(RecoveryAction.outcome)
        )
        .where(RecoveryAction.id == action_id)
    )
    result = await db.execute(stmt)
    action = result.scalar_one_or_none()

    if not action:
        raise HTTPException(status_code=404, detail="Recovery action proposal not found")

    if action.review_status != 'pending':
        raise HTTPException(
            status_code=400,
            detail=f"Action is not pending review (current status: '{action.review_status}')"
        )

    # Mark approved
    action.review_status = 'approved'
    action.reviewed_by = req.reviewed_by or "Risk Ops Specialist"
    action.reviewed_at = utcnow()
    action.review_reason = req.review_reason

    await db.commit()
    await db.refresh(action)

    # Audit log
    await audit_logger.log(db, action.event_id, 'human_approved', {
        'action_id': action.id,
        'action_type': action.action_type,
        'reviewed_by': action.reviewed_by,
        'review_reason': action.review_reason or "Approved by risk operator for execution"
    }, actor=action.reviewed_by)

    # Trigger execution immediately
    await actor.execute_action(db, action, action.event)

    # Reload action with outcome
    stmt_reloaded = (
        select(RecoveryAction)
        .options(
            selectinload(RecoveryAction.outcome),
            selectinload(RecoveryAction.diagnosis)
        )
        .where(RecoveryAction.id == action_id)
    )
    action_reloaded = (await db.execute(stmt_reloaded)).scalar_one_or_none()
    return action_reloaded


@router.post("/api/review/{action_id}/reject", response_model=RecoveryActionOut)
async def reject_recovery_action(
    action_id: int,
    req: ReviewRejectRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Human Rejects Proposal:
    1. Sets review_status = 'rejected', logs required justification reason.
    2. Sets action status = 'rejected' and event status = 'unrecoverable'.
    3. Emits 'human_rejected' audit trail entry.
    4. Halts execution permanently (no recovery execution or retries).
    """
    if not req.review_reason or not req.review_reason.strip():
        raise HTTPException(status_code=422, detail="A justification reason is required when rejecting a proposal")

    stmt = (
        select(RecoveryAction)
        .options(
            selectinload(RecoveryAction.event),
            selectinload(RecoveryAction.diagnosis),
            selectinload(RecoveryAction.outcome)
        )
        .where(RecoveryAction.id == action_id)
    )
    result = await db.execute(stmt)
    action = result.scalar_one_or_none()

    if not action:
        raise HTTPException(status_code=404, detail="Recovery action proposal not found")

    if action.review_status != 'pending':
        raise HTTPException(
            status_code=400,
            detail=f"Action is not pending review (current status: '{action.review_status}')"
        )

    # Mark rejected
    action.review_status = 'rejected'
    action.status = 'rejected'
    action.reviewed_by = req.reviewed_by or "Risk Ops Specialist"
    action.reviewed_at = utcnow()
    action.review_reason = req.review_reason.strip()

    event = action.event
    if event:
        event.status = 'unrecoverable'

    await db.commit()
    await db.refresh(action)

    # Audit log
    await audit_logger.log(db, action.event_id, 'human_rejected', {
        'action_id': action.id,
        'action_type': action.action_type,
        'reviewed_by': action.reviewed_by,
        'review_reason': action.review_reason
    }, actor=action.reviewed_by)

    # Reload action
    stmt_reloaded = (
        select(RecoveryAction)
        .options(
            selectinload(RecoveryAction.outcome),
            selectinload(RecoveryAction.diagnosis)
        )
        .where(RecoveryAction.id == action_id)
    )
    action_reloaded = (await db.execute(stmt_reloaded)).scalar_one_or_none()
    return action_reloaded
