import asyncio
import httpx
import hmac
import hashlib
import json

async def test_all():
    async with httpx.AsyncClient(follow_redirects=True) as client:
        print("--- 1. Testing Scenario Driver (Real Test-Mode Objects) ---")
        res = await client.post(
            "http://localhost:8000/api/scenarios/run",
            json={"payment_failures": 3, "checkout_abandons": 2, "receivables_overdue": 1}
        )
        assert res.status_code == 200, f"Scenario run failed: {res.text}"
        data = res.json()
        print(f"Created {len(data['events'])} events via scenario driver.")
        print(f"Real Orders: {data['real_order_ids']}")
        print(f"Real Payments: {data['real_payment_ids']}")
        assert len(data["events"]) == 6

        print("\n--- 2. Testing Webhook Receiver & HMAC Verification ---")
        # 2a. Valid signature payload
        secret = "test_webhook_secret_123"
        payload = {
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_s2s_9988",
                        "order_id": "order_test_9988",
                        "amount": 1500000,
                        "currency": "INR",
                        "error_code": "BAD_REQUEST_ERROR",
                        "error_description": "Payment failed due to insufficient funds in customer bank account",
                        "error_source": "customer",
                        "error_step": "payment_authorization",
                        "error_reason": "insufficient_funds",
                        "method": "card",
                        "email": "customer.test@enterprise.in"
                    }
                }
            }
        }
        body_str = json.dumps(payload)
        sig = hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()

        # Webhook without secret configured accepts in test mode, or checks HMAC if secret provided
        r_wh = await client.post(
            "http://localhost:8000/api/webhooks/razorpay",
            content=body_str,
            headers={"Content-Type": "application/json", "x-razorpay-signature": sig}
        )
        print(f"Webhook Response: {r_wh.status_code}, {r_wh.json()}")
        assert r_wh.status_code == 200

        print("\n--- 3. Testing Webhook Payment Captured (Real Recovery Reward) ---")
        captured_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_s2s_9988",
                        "order_id": "order_test_9988",
                        "amount": 1500000,
                        "currency": "INR",
                        "status": "captured"
                    }
                }
            }
        }
        cap_body = json.dumps(captured_payload)
        cap_sig = hmac.new(secret.encode(), cap_body.encode(), hashlib.sha256).hexdigest()
        r_cap = await client.post(
            "http://localhost:8000/api/webhooks/razorpay",
            content=cap_body,
            headers={"Content-Type": "application/json", "x-razorpay-signature": cap_sig}
        )
        print(f"Payment Captured Response: {r_cap.status_code}, {r_cap.json()}")
        assert r_cap.status_code == 200

        print("\n--- 4. Verify Ingested Events have verbatim error codes ---")
        ev_res = await client.get("http://localhost:8000/api/events/?page_size=5")
        events = ev_res.json()["items"]
        first_ev = events[0]
        amt = first_ev['amount_display'].replace('\u20b9', 'Rs. ')
        print(f"Event #{first_ev['id']}: Type={first_ev['event_type']}, Amount={amt}, Reason={first_ev['error_reason']}")
        assert first_ev['error_reason'] is not None

        print("\n--- ALL SCENARIO DRIVER & WEBHOOK TESTS PASSED! ---")

if __name__ == "__main__":
    asyncio.run(test_all())
