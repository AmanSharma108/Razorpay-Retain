from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import RecoveryAction, RevenueEvent, PolicyStats
from app.schemas import PaginatedResponse, RecoveryActionOut, PolicyStatsOut
from app.services import diagnosis_engine, recovery_policy, verifier, actor

router = APIRouter(prefix="/api/recovery", tags=["recovery"])

@router.get("/actions", response_model=PaginatedResponse[RecoveryActionOut])
async def list_actions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(RecoveryAction).options(selectinload(RecoveryAction.outcome)).order_by(desc(RecoveryAction.created_at))
    
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return PaginatedResponse(items=list(items), total=total, page=page, page_size=page_size)

@router.post("/actions/{event_id}/retry", response_model=RecoveryActionOut)
async def retry_recovery(event_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(RevenueEvent).where(RevenueEvent.id == event_id)
    event = (await db.execute(stmt)).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    diagnosis = await diagnosis_engine.diagnose(db, event)
    action = await recovery_policy.select_action(db, event, diagnosis)
    
    # Evaluate Human Review Gate
    action = await verifier.evaluate_human_review_gate(db, action, event, diagnosis)
    
    # Only execute if auto-approved
    if action.review_status != 'pending':
        await actor.execute_action(db, action, event)
    
    # Reload with outcome
    action_stmt = select(RecoveryAction).options(selectinload(RecoveryAction.outcome)).where(RecoveryAction.id == action.id)
    action_reloaded = (await db.execute(action_stmt)).scalar_one_or_none()
    return action_reloaded

@router.get("/policy-stats", response_model=List[PolicyStatsOut])
async def get_policy_stats(db: AsyncSession = Depends(get_db)):
    stmt = select(PolicyStats)
    result = await db.execute(stmt)
    return list(result.scalars().all())
