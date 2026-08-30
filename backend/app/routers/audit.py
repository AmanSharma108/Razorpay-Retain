from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models import AuditTrail
from app.schemas import PaginatedResponse, AuditTrailOut

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/trail", response_model=PaginatedResponse[AuditTrailOut])
async def list_audit_trail(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    event_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AuditTrail).order_by(desc(AuditTrail.created_at))
    
    if event_id:
        stmt = stmt.where(AuditTrail.event_id == event_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return PaginatedResponse(items=list(items), total=total, page=page, page_size=page_size)
