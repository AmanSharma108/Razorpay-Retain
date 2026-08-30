import asyncio
import httpx
import json

async def verify_polling_safetynet():
    async with httpx.AsyncClient(follow_redirects=True) as client:
        print("=== 1. Testing GET /api/polling/status ===")
        r = await client.get("http://localhost:8000/api/polling/status")
        assert r.status_code == 200, f"Status call failed: {r.text}"
        status = r.json()
        print("Polling Status:", status)
        assert "is_running" in status
        assert "interval_seconds" in status

        print("\n=== 2. Testing POST /api/polling/interval ===")
        r_int = await client.post("http://localhost:8000/api/polling/interval", json={"interval_seconds": 30})
        assert r_int.status_code == 200
        assert r_int.json()["interval_seconds"] == 30
        print("Updated interval to 30s successfully.")

        print("\n=== 3. Testing Idempotency: Webhook Ingestion followed by Polling Check ===")
        # 3a. Ingest an event via Webhook
        test_pay_id = "pay_idemp_test_7788"
        webhook_payload = {
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "id": test_pay_id,
                        "amount": 250000,
                        "currency": "INR",
                        "error_code": "BAD_REQUEST_ERROR",
                        "error_reason": "insufficient_funds",
                        "method": "card",
                        "email": "idemp.test@enterprise.in"
                    }
                }
            }
        }
        r_wh = await client.post(
            "http://localhost:8000/api/webhooks/razorpay",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        assert r_wh.status_code == 200
        print(f"Ingested payment {test_pay_id} via webhook.")

        # Check total events count
        r_ev1 = await client.get("http://localhost:8000/api/events/?page_size=100")
        count_before = r_ev1.json()["total"]

        # 3b. Trigger Immediate Polling Cycle
        r_poll = await client.post("http://localhost:8000/api/polling/trigger")
        assert r_poll.status_code == 200
        poll_res = r_poll.json()
        print(f"Triggered Polling Cycle: New={poll_res['result']['new_events']}, Skipped Duplicates={poll_res['result']['skipped_duplicates']}")

        # 3c. Send the same webhook payload a second time (Simulating duplicate delivery)
        r_wh_dup = await client.post(
            "http://localhost:8000/api/webhooks/razorpay",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        assert r_wh_dup.status_code == 200

        # Check total events count after duplicate attempt
        r_ev2 = await client.get("http://localhost:8000/api/events/?page_size=100")
        count_after = r_ev2.json()["total"]

        print(f"Events Count Before: {count_before}, After Duplicate Trigger: {count_after}")
        assert count_after == count_before, "Deduplication failed: Duplicate event row was created!"

        print("\n=== ALL POLLING SAFETY NET & IDEMPOTENCY TESTS PASSED 100%! ===")

if __name__ == "__main__":
    asyncio.run(verify_polling_safetynet())
