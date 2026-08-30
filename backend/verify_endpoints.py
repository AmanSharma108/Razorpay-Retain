import asyncio
import httpx

async def verify():
    async with httpx.AsyncClient() as client:
        # 1. Fetch count
        res = await client.get("http://localhost:8000/api/review-queue/count")
        print("Count Response:", res.json())
        assert res.status_code == 200
        count = res.json()["count"]
        assert count > 0

        # 2. Fetch queue
        res = await client.get("http://localhost:8000/api/review-queue")
        queue = res.json()
        print(f"Fetched {len(queue)} queue items")
        first_item = queue[0]
        amt = first_item["amount_display"].replace('\u20b9', 'Rs. ')
        triggers = [t.replace('\u20b9', 'Rs. ') for t in first_item["review_trigger_reasons"]]
        print("Item 1:", first_item["id"], first_item["loss_type"], amt, triggers)

        # 3. Test Approval on first item
        action_id = first_item["id"]
        res_approve = await client.post(
            f"http://localhost:8000/api/review/{action_id}/approve",
            json={"reviewed_by": "Test Operator", "review_reason": "Approved via verification script"}
        )
        print("Approve Response:", res_approve.status_code, res_approve.json()["review_status"], res_approve.json()["status"])
        assert res_approve.status_code == 200
        assert res_approve.json()["review_status"] == "approved"
        assert res_approve.json()["status"] == "executed"

        # 4. Test Rejection on second item
        if len(queue) > 1:
            second_item = queue[1]
            res_reject = await client.post(
                f"http://localhost:8000/api/review/{second_item['id']}/reject",
                json={"reviewed_by": "Test Operator", "review_reason": "Rejected due to bank downtime"}
            )
            print("Reject Response:", res_reject.status_code, res_reject.json()["review_status"], res_reject.json()["status"])
            assert res_reject.status_code == 200
            assert res_reject.json()["review_status"] == "rejected"
            assert res_reject.json()["status"] == "rejected"

        # 5. Check Dashboard Summary has pending_reviews
        res_summary = await client.get("http://localhost:8000/api/dashboard/summary")
        summary = res_summary.json()
        print("Dashboard Summary pending_reviews:", summary["pending_reviews"])
        assert "pending_reviews" in summary

        print("--- ALL REST API ENDPOINTS VERIFIED SUCCESSFULLY! ---")

if __name__ == "__main__":
    asyncio.run(verify())
