import json
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditTrail

async def log(db: AsyncSession, event_id: int, stage: str, details: dict, actor: str = 'system') -> AuditTrail:
    entry = AuditTrail(
        event_id=event_id,
        stage=stage,
        actor=actor,
        details=json.dumps(details)
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
