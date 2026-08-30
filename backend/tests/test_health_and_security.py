import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "components" in data
    assert data["components"]["database"]["status"] == "connected"
    assert "uptime_seconds" in data


@pytest.mark.asyncio
async def test_liveness_probe(client: AsyncClient):
    response = await client.get("/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert "x-request-id" in headers
    assert "x-process-time-ms" in headers


@pytest.mark.asyncio
async def test_custom_request_id_propagated(client: AsyncClient):
    custom_req_id = "test-custom-request-uuid-12345"
    response = await client.get("/health", headers={"X-Request-ID": custom_req_id})
    assert response.status_code == 200
    assert response.headers.get("x-request-id") == custom_req_id


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "health" in data
