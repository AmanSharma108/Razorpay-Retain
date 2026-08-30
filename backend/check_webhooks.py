import asyncio
import httpx
from sqlalchemy import select
from app.database import async_session_maker
from app.models import WebhookLog, RevenueEvent

async def check():
    async with async_session_maker() as db:
        stmt = select(WebhookLog).order_by(WebhookLog.id.desc()).limit(10)
        res = await db.execute(stmt)
        logs = res.scalars().all()
        print(f"--- Webhook Logs Found in Database: {len(logs)} ---")
        for log in logs:
            print(f"ID: {log.id} | Event: {log.event_type} | Verified: {log.verified} | Received: {log.received_at}")

        stmt_events = select(RevenueEvent).order_by(RevenueEvent.id.desc()).limit(5)
        res_ev = await db.execute(stmt_events)
        events = res_ev.scalars().all()
        print(f"\n--- Latest Revenue Events: {len(events)} ---")
        for ev in events:
            print(f"Event #{ev.id} | Type: {ev.event_type} | Amount: Rs. {ev.amount_at_risk/100:.2f} | Status: {ev.status}")

if __name__ == "__main__":
    asyncio.run(check())
