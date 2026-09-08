import pytest

from app.core.config import settings
from test_signals import _reset_db, _create_user, _login, _headers


def setup_editor(client):
    _reset_db()
    _create_user("body-editor@jion.test", "body-editor", admin=True)
    return _headers(_login(client, "body-editor@jion.test"))


def article(**changes):
    return {
        "title": "A complete editorial explanation",
        "summary": "A concise introduction to a useful new discovery.",
        "body": "## What changed\n\nA complete explanation.\n\n| Plan | Access |\n|---|---|\n| Local | Preview |",
        "content_kind": "release", "source_kind": "official_blog",
        "source_name": "Example Lab", "source_url": "https://example.com/editorial",
        "verification_level": "official", "status": "review", **changes,
    }


@pytest.mark.parametrize("kind", ["release", "research"])
def test_editorial_body_roundtrip_and_publish_without_exercise(client, kind):
    headers = setup_editor(client)
    payload = article(content_kind=kind)
    created = client.post("/api/v1/signals/", headers=headers, json=payload)
    assert created.status_code == 201
    signal = created.json()
    assert signal["body"] == payload["body"]
    assert client.get(f"/api/v1/signals/{signal['slug']}").status_code == 404
    published = client.patch(f"/api/v1/signals/{signal['id']}/review", headers=headers,
                             json={"action": "publish"})
    assert published.status_code == 200
    assert published.json()["try_this"] is None
    assert client.get(f"/api/v1/signals/{signal['slug']}").json()["body"] == payload["body"]
    updated = client.patch(f"/api/v1/signals/{signal['id']}", headers=headers,
                           json={"summary": "An updated list introduction with the same body."})
    assert updated.status_code == 200
    assert updated.json()["body"] == payload["body"]
    assert updated.json()["slug"] == signal["slug"]


def test_workflow_still_requires_action_and_unverified_stays_private(client):
    headers = setup_editor(client)
    for payload in [article(status="published", content_kind="workflow"),
                    article(status="published", verification_level="unverified"),
                    article(status="published", body="  ")]:
        assert client.post("/api/v1/signals/", headers=headers, json=payload).status_code == 422
    assert client.get("/api/v1/signals/").json()["total"] == 0


def test_legacy_content_stays_intact_and_can_fall_back(client):
    headers = setup_editor(client)
    payload = article(body=None, why_it_matters="Legacy explanation", try_this="Legacy steps", status="published")
    signal = client.post("/api/v1/signals/", headers=headers, json=payload).json()
    assert signal["body"] is None
    assert signal["why_it_matters"] == payload["why_it_matters"]
    assert signal["try_this"] == payload["try_this"]
    path = f"/api/v1/signals/{signal['id']}"
    assert client.patch(path, headers=headers, json={"body": "## New body"}).status_code == 200
    restored = client.patch(path, headers=headers, json={"body": None}).json()
    assert restored["body"] is None
    assert restored["why_it_matters"] == payload["why_it_matters"]


def test_ingested_body_requires_review_even_with_legacy_fields(client, monkeypatch):
    setup_editor(client)
    monkeypatch.setattr(settings, "SIGNAL_BOT_TOKEN", "local-body-test-token")
    response = client.post("/api/v1/signals/ingest", headers={"X-Signal-Bot-Token": "local-body-test-token"},
                           json=article(status="published", why_it_matters="Context", try_this="Steps"))
    assert response.status_code == 201
    assert response.json()["status"] == "review"
    assert client.get("/api/v1/signals/").json()["total"] == 0


def test_body_access_and_size_guards(client):
    headers = setup_editor(client)
    assert client.post("/api/v1/signals/", json=article()).status_code == 403
    assert client.post("/api/v1/signals/", headers=headers, json=article(body="x" * 20001)).status_code == 400
