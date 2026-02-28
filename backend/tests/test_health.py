def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_detailed_health_endpoint(client):
    response = client.get("/health/detailed")
    assert response.status_code == 200
    payload = response.json()
    assert "status" in payload
    assert "checks" in payload
    assert payload["checks"]["database"] in {"ok", "error"}


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "jion MCP Marketplace API"
    assert payload["version"] == "2.0.0"
