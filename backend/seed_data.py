import asyncio
import httpx
import random

API_BASE = "http://localhost:8000/api"

async def seed():
    async with httpx.AsyncClient() as client:
        print("Seeding events with human-approval gate data...")
        event_ids = []
        
        # 1. Standard and High-value Payment failures (8)
        for _ in range(8):
            r = await client.post(f"{API_BASE}/simulate/payment-failure")
            if r.status_code == 200:
                event_ids.append(r.json()["id"])
            
        # 2. Checkout abandonments (5) - some will trigger discount action review
        for _ in range(5):
            r = await client.post(f"{API_BASE}/simulate/checkout-abandonment")
            if r.status_code == 200:
                event_ids.append(r.json()["id"])
            
        # 3. Expired invoices (4) - some high value
        for _ in range(4):
            r = await client.post(f"{API_BASE}/simulate/invoice-expired")
            if r.status_code == 200:
                event_ids.append(r.json()["id"])
            
        # 4. Halted subscriptions (4) - systemic severity 5 alerts
        for _ in range(4):
            r = await client.post(f"{API_BASE}/simulate/subscription-halted")
            if r.status_code == 200:
                event_ids.append(r.json()["id"])
            
        print(f"Created {len(event_ids)} events.")
        
        # Check review queue
        rq = await client.get(f"{API_BASE}/review-queue")
        if rq.status_code == 200:
            queue = rq.json()
            print(f"Pending human reviews in queue: {len(queue)}")
            for item in queue[:3]:
                amt = item['amount_display'].replace('\u20b9', 'Rs. ')
                triggers = [t.replace('\u20b9', 'Rs. ') for t in item['review_trigger_reasons']]
                print(f"  -> Action #{item['id']} for Event #{item['event_id']}: {amt} | {item['proposed_action']} | Triggers: {triggers}")
        
        # Simulate recovery success for ~40% of non-pending / auto-executed events
        success_count = 0
        for eid in event_ids:
            if random.random() < 0.4:
                try:
                    r = await client.post(f"{API_BASE}/simulate/recovery-success", json={"event_id": eid})
                    if r.status_code == 200:
                        success_count += 1
                except Exception as e:
                    pass
                    
        print(f"Simulated {success_count} successful recoveries.")
        print("Seed complete.")

if __name__ == "__main__":
    asyncio.run(seed())
