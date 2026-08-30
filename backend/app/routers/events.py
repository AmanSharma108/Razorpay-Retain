from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import RevenueEvent, RecoveryAction
from app.schemas import PaginatedResponse, EventOut, EventDetail

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("/", response_model=PaginatedResponse[EventOut])
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(RevenueEvent).order_by(desc(RevenueEvent.created_at))
    
    if event_type:
        stmt = stmt.where(RevenueEvent.event_type == event_type)
    if status:
        stmt = stmt.where(RevenueEvent.status == status)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return PaginatedResponse(items=list(items), total=total, page=page, page_size=page_size)

@router.get("/{event_id}", response_model=EventDetail)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(RevenueEvent)
        .options(
            selectinload(RevenueEvent.diagnoses),
            selectinload(RevenueEvent.recovery_actions).selectinload(RecoveryAction.outcome),
            selectinload(RevenueEvent.audit_entries)
        )
        .where(RevenueEvent.id == event_id)
    )
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return event
