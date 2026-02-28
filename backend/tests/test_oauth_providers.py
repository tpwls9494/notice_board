def test_oauth_providers_default_disabled(client):
    response = client.get("/api/v1/auth/oauth/providers")
    assert response.status_code == 200
    payload = response.json()
    assert payload["google"] is False
    assert payload["github"] is False
