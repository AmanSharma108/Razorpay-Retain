from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.database import get_db
from app.models import RevenueEvent, ActionOutcome, RecoveryAction
from app.schemas import DashboardSummary, AnalyticsData

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: AsyncSession = Depends(get_db)):
    at_risk_stmt = select(func.sum(RevenueEvent.amount_at_risk))
    total_at_risk = (await db.scalar(at_risk_stmt)) or 0

    recovered_stmt = select(func.sum(ActionOutcome.amount_recovered)).where(ActionOutcome.success == True)
    total_recovered = (await db.scalar(recovered_stmt)) or 0
    
    recovery_rate = (total_recovered / total_at_risk * 100) if total_at_risk > 0 else 0.0
    
    active_stmt = select(func.count(RevenueEvent.id)).where(RevenueEvent.status.notin_(['recovered', 'unrecoverable']))
    active_events = (await db.scalar(active_stmt)) or 0

    # Count pending human reviews
    pending_review_stmt = select(func.count(RecoveryAction.id)).where(RecoveryAction.review_status == 'pending')
    pending_reviews = (await db.scalar(pending_review_stmt)) or 0

    type_stmt = select(RevenueEvent.event_type, func.count(RevenueEvent.id)).group_by(RevenueEvent.event_type)
    type_result = await db.execute(type_stmt)
    events_by_type = {row[0]: row[1] for row in type_result.all()}

    status_stmt = select(RevenueEvent.status, func.count(RevenueEvent.id)).group_by(RevenueEvent.status)
    status_result = await db.execute(status_stmt)
    events_by_status = {row[0]: row[1] for row in status_result.all()}

    return DashboardSummary(
        total_at_risk=total_at_risk,
        total_recovered=total_recovered,
        recovery_rate=recovery_rate,
        active_events=active_events,
        pending_reviews=pending_reviews,
        events_by_type=events_by_type,
        events_by_status=events_by_status
    )

@router.get("/analytics", response_model=List[AnalyticsData])
async def get_analytics(db: AsyncSession = Depends(get_db)):
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    date_func = func.date(RevenueEvent.created_at)
    
    stmt = (
        select(
            date_func.label("date"),
            func.sum(RevenueEvent.amount_at_risk).label("at_risk"),
            func.sum(
                case(
                    (ActionOutcome.success == True, ActionOutcome.amount_recovered),
                    else_=0
                )
            ).label("recovered")
        )
        .outerjoin(ActionOutcome, RevenueEvent.id == ActionOutcome.event_id)
        .where(RevenueEvent.created_at >= thirty_days_ago)
        .group_by(date_func)
        .order_by(date_func)
    )
    
    result = await db.execute(stmt)
    data = []
    for row in result.all():
        data.append(AnalyticsData(
            date=str(row.date),
            at_risk=row.at_risk or 0,
            recovered=row.recovered or 0
        ))
        
    return data
