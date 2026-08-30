import asyncio
import httpx
import json

async def inspect():
    async with httpx.AsyncClient() as client:
        r = await client.get('http://localhost:8000/api/audit/trail?page_size=30')
        items = r.json()['items']
        print(f"Inspecting {len(items)} audit entries...")
        for item in items:
            if item['stage'] == 'action_selected':
                print(f"\n--- Stage: {item['stage']} (Event #{item['event_id']}) ---")
                details = item['details']
                rationale = details.get('rationale', '').encode('ascii', errors='replace').decode('ascii')
                print(f"Rationale: {rationale}")
                print(f"Candidate Arms: {details.get('candidate_arms')}")
                if details.get('decision_telemetry'):
                    posteriors = details['decision_telemetry'].get('candidate_posteriors', {})
                    print(f"Candidate Posteriors: {posteriors}")
                break

if __name__ == "__main__":
    asyncio.run(inspect())
