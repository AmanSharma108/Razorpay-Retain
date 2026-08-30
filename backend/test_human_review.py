import asyncio
from datetime import datetime, timezone
import json
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.database import Base
from app.models import RevenueEvent, Diagnosis, RecoveryAction, AuditTrail, PolicyStats
from app.services import diagnosis_engine, recovery_policy, verifier, actor, event_ingester

async def run_test():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as db:
        print("--- Test 1: Low-Value Event (< Rs 10,000) with non-discount action ---")
        # Ingest low value cancelled payment
        evt1 = await event_ingester.ingest_simulated_event(
            db,
            event_type="payment_failed",
            amount=450000, # Rs 4,500.00
            customer_email="test@low.com",
            error_source="customer",
            error_reason="cancelled"
        )
        await db.refresh(evt1)
        print(f"Event 1 Status: {evt1.status}, Amount: Rs {evt1.amount_at_risk/100:.2f}")
        
        # Check action
        stmt = await db.execute(select(RecoveryAction).where(RecoveryAction.event_id == evt1.id))
        act1 = stmt.scalar_one_or_none()
        print(f"Action 1 Type: {act1.action_type}, requires_human_review: {act1.requires_human_review}, review_status: {act1.review_status}, status: {act1.status}")
        assert act1.review_status in ('not_required', 'pending')
        
        print("\n--- Test 2: High-Value Event (> Rs 10,000 / 1,000,000 paise) ---")
        evt2 = await event_ingester.ingest_simulated_event(
            db,
            event_type="payment_failed",
            amount=1500000, # Rs 15,000.00 (> 10k)
            customer_email="vip@corp.com",
            error_source="customer",
            error_reason="timeout"
        )
        await db.refresh(evt2)
        stmt2 = await db.execute(select(RecoveryAction).where(RecoveryAction.event_id == evt2.id))
        act2 = stmt2.scalar_one_or_none()
        print(f"Event 2 Status: {evt2.status}, Amount: Rs {evt2.amount_at_risk/100:.2f}")
        print(f"Action 2 Type: {act2.action_type}, requires_human_review: {act2.requires_human_review}, review_status: {act2.review_status}, status: {act2.status}")
        assert act2.requires_human_review == True
        assert act2.review_status == 'pending'
        assert act2.status == 'pending' # NOT executed yet
        
        print("\n--- Test 3: Systemic Gateway Outage Event ---")
        evt3 = await event_ingester.ingest_simulated_event(
            db,
            event_type="payment_failed",
            amount=200000, # Rs 2,000.00
            customer_email="user@bank.com",
            error_source="gateway",
            error_reason="gateway_down"
        )
        await db.refresh(evt3)
        stmt3 = await db.execute(select(RecoveryAction).where(RecoveryAction.event_id == evt3.id))
        act3 = stmt3.scalar_one_or_none()
        print(f"Event 3 Status: {evt3.status}, Action 3 Type: {act3.action_type}, review_status: {act3.review_status}")
        assert act3.requires_human_review == True
        assert act3.review_status == 'pending'
        
        print("\n--- Test 4: Human Approves Event 2 ---")
        act2.review_status = 'approved'
        act2.reviewed_by = 'Chief Risk Officer'
        act2.reviewed_at = datetime.now(timezone.utc)
        act2.review_reason = 'Verified merchant VIP status and approved custom link'
        await db.commit()
        
        # Now trigger execution
        await actor.execute_action(db, act2, evt2)
        await db.refresh(act2)
        print(f"Action 2 post-approval status: {act2.status}, executed_at: {act2.executed_at}")
        assert act2.status == 'executed'
        
        print("\n--- Test 5: Human Rejects Event 3 ---")
        act3.review_status = 'rejected'
        act3.status = 'rejected'
        act3.reviewed_by = 'Incident Commander'
        act3.reviewed_at = datetime.now(timezone.utc)
        act3.review_reason = 'Gateway is actively degraded nationwide; holding traffic'
        evt3.status = 'unrecoverable'
        await db.commit()
        
        # Verify executor will not execute rejected action
        await actor.execute_action(db, act3, evt3)
        await db.refresh(act3)
        print(f"Action 3 post-rejection status: {act3.status}")
        assert act3.status == 'rejected'
        
        print("\n--- ALL BACKEND TESTS PASSED! ---")

if __name__ == "__main__":
    asyncio.run(run_test())
