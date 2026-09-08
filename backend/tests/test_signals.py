from app.api.v1.signals import comment_limiter, ingest_limiter
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base, engine
from app.db.session import SessionLocal
from app.models.user import User


def _reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    comment_limiter.clear()
    ingest_limiter.clear()


def _create_user(email: str, username: str, *, admin: bool = False) -> None:
    with SessionLocal() as db:
        db.add(
            User(
                email=email,
                username=username,
                hashed_password=get_password_hash("password123"),
                has_local_password=True,
                email_verified=True,
                is_admin=admin,
            )
        )
        db.commit()


def _login(client, email: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_signal_is_hidden_until_admin_publishes_it(client):
    _reset_db()
    _create_user("admin@jion.test", "jion-admin", admin=True)
    token = _login(client, "admin@jion.test")

    created = client.post(
        "/api/v1/signals/",
        headers=_headers(token),
        json={
            "title": "작은 언어 모델을 위한 새로운 학습 도구",
            "summary": "공식 저장소에서 공개한 학습 도구의 핵심 변경 사항을 정리합니다.",
            "why_it_matters": "작은 GPU 환경에서도 실험 범위를 넓힐 수 있습니다.",
            "try_this": "공식 예제를 작은 데이터셋으로 먼저 실행해보세요.",
            "content_kind": "research",
            "source_kind": "github",
            "source_name": "Official repository",
            "source_url": "https://github.com/example/slm-tool",
            "verification_level": "official",
            "status": "review",
            "tags": ["SLM", "fine-tuning"],
        },
    )
    assert created.status_code == 201
    signal = created.json()

    hidden = client.get("/api/v1/signals/")
    assert hidden.status_code == 200
    assert hidden.json()["total"] == 0
    assert client.get(f"/api/v1/signals/{signal['slug']}").status_code == 404
    assert signal["slug"] not in client.get("/sitemap.xml").text

    published = client.patch(
        f"/api/v1/signals/{signal['id']}/review",
        headers=_headers(token),
        json={"action": "publish", "verification_level": "official"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"

    public_list = client.get("/api/v1/signals/")
    assert public_list.status_code == 200
    assert public_list.json()["total"] == 1
    assert signal["slug"] in client.get("/sitemap.xml").text

    detail = client.get(f"/api/v1/signals/{signal['slug']}")
    assert detail.status_code == 200
    assert detail.json()["views"] == 1

    assert client.post(
        f"/api/v1/signals/{signal['slug']}/recommend",
        headers=_headers(token),
    ).status_code == 204
    recommended = client.get(f"/api/v1/signals/{signal['slug']}", headers=_headers(token))
    assert recommended.json()["recommendation_count"] == 1
    assert recommended.json()["is_recommended"] is True

    held = client.patch(
        f"/api/v1/signals/{signal['id']}/review",
        headers=_headers(token),
        json={"action": "hold"},
    )
    assert held.status_code == 200
    assert client.get(f"/api/v1/signals/{signal['slug']}").status_code == 404


def test_verified_user_can_comment_and_save_interests(client):
    _reset_db()
    _create_user("admin2@jion.test", "jion-admin-2", admin=True)
    _create_user("reader@jion.test", "curious-reader")
    admin_token = _login(client, "admin2@jion.test")
    reader_token = _login(client, "reader@jion.test")

    created = client.post(
        "/api/v1/signals/",
        headers=_headers(admin_token),
        json={
            "title": "에이전트 작업을 나누는 실전 방법",
            "summary": "서로 독립적인 작업을 나누고 결과를 합치는 방법을 소개합니다.",
            "content_kind": "workflow",
            "why_it_matters": "Splitting work can reduce omissions and make complex requests easier to inspect.",
            "try_this": "Run two small research tasks separately and compare the combined result.",
            "source_kind": "official_blog",
            "source_name": "Example AI Lab",
            "source_url": "https://example.com/agent-workflow",
            "verification_level": "official",
            "status": "published",
        },
    )
    assert created.status_code == 201
    slug = created.json()["slug"]

    comment = client.post(
        f"/api/v1/signals/{slug}/comments",
        headers=_headers(reader_token),
        json={"kind": "experience", "content": "작업 경계를 명확히 했을 때 특히 효과가 좋았습니다."},
    )
    assert comment.status_code == 201
    assert comment.json()["author_username"] == "curious-reader"

    interests = client.put(
        "/api/v1/signals/me/interests",
        headers=_headers(reader_token),
        json={"keywords": ["SLM", "에이전트", "slm", "  프롬프트  "]},
    )
    assert interests.status_code == 200
    assert interests.json()["keywords"] == ["SLM", "에이전트", "프롬프트"]


def test_ingest_publishes_sourced_items_but_keeps_unverified_items_private(client, monkeypatch):
    _reset_db()
    monkeypatch.setattr(settings, "SIGNAL_BOT_TOKEN", "test-collector-token")
    payload = {
        "title": "A new SLM release for local inference",
        "summary": "The primary source describes a smaller model for local inference.",
        "why_it_matters": "It may reduce the hardware required for a local experiment.",
        "try_this": "Read the model card and reproduce one official example first.",
        "content_kind": "release",
        "source_kind": "github",
        "source_name": "Example Lab",
        "source_url": "https://example.com/releases/slm",
        "verification_level": "official",
        "status": "published",
    }

    assert client.post("/api/v1/signals/ingest", json=payload).status_code == 401
    created = client.post(
        "/api/v1/signals/ingest",
        headers={"X-Signal-Bot-Token": "test-collector-token"},
        json=payload,
    )
    assert created.status_code == 201
    assert created.json()["status"] == "published"
    assert client.get("/api/v1/signals/").json()["total"] == 1

    duplicate_payload = {
        **payload,
        "title": "The same release from a tracked URL",
        "source_url": "http://www.example.com/releases/slm?utm_source=social",
    }
    duplicate = client.post(
        "/api/v1/signals/ingest",
        headers={"X-Signal-Bot-Token": "test-collector-token"},
        json=duplicate_payload,
    )
    assert duplicate.status_code == 409

    unverified_payload = {
        **payload,
        "title": "An unverified AI rumor",
        "source_url": "https://example.com/rumors/slm",
        "verification_level": "unverified",
    }
    unverified = client.post(
        "/api/v1/signals/ingest",
        headers={"X-Signal-Bot-Token": "test-collector-token"},
        json=unverified_payload,
    )
    assert unverified.status_code == 201
    assert unverified.json()["status"] == "review"
    assert client.get("/api/v1/signals/").json()["total"] == 1


def test_admin_must_complete_editorial_fields_before_publish(client):
    _reset_db()
    _create_user("editor@jion.test", "signal-editor", admin=True)
    admin_token = _login(client, "editor@jion.test")

    draft = client.post(
        "/api/v1/signals/",
        headers=_headers(admin_token),
        json={
            "title": "검토 필요 · example.com",
            "summary": "관리자가 내용을 보완해야 하는 수집 항목입니다.",
            "content_kind": "workflow",
            "source_kind": "rss",
            "source_name": "Example source",
            "source_url": "https://example.com/community-tip",
            "verification_level": "unverified",
            "status": "review",
        },
    ).json()
    blocked = client.patch(
        f"/api/v1/signals/{draft['id']}/review",
        headers=_headers(admin_token),
        json={"action": "publish", "verification_level": "community"},
    )
    assert blocked.status_code == 422

    updated = client.patch(
        f"/api/v1/signals/{draft['id']}",
        headers=_headers(admin_token),
        json={
            "title": "작은 모델 평가를 빠르게 비교한 사용 경험",
            "summary": "동일한 데이터와 조건에서 두 모델의 결과와 실행 시간을 비교한 경험입니다.",
            "why_it_matters": "모델 크기만 보고 선택할 때 놓치기 쉬운 실제 실행 차이를 보여줍니다.",
            "try_this": "같은 프롬프트 열 개로 후보 모델 두 개를 먼저 비교해 보세요.",
            "verification_level": "community",
        },
    )
    assert updated.status_code == 200
    assert not updated.json()["slug"].startswith("검토-필요")
    published = client.patch(
        f"/api/v1/signals/{draft['id']}/review",
        headers=_headers(admin_token),
        json={"action": "publish", "verification_level": "community"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"


def test_comment_owner_can_delete_and_admin_can_hide(client):
    _reset_db()
    _create_user("moderator@jion.test", "signal-moderator", admin=True)
    _create_user("commenter@jion.test", "signal-commenter")
    admin_token = _login(client, "moderator@jion.test")
    user_token = _login(client, "commenter@jion.test")
    signal = client.post(
        "/api/v1/signals/",
        headers=_headers(admin_token),
        json={
            "title": "A practical prompt workflow guide",
            "summary": "A practical guide for testing and comparing prompt workflows safely.",
            "why_it_matters": "It makes workflow changes measurable before wider adoption.",
            "try_this": "Run the guide against five representative tasks and compare results.",
            "content_kind": "workflow",
            "source_kind": "official_blog",
            "source_name": "Example Lab",
            "source_url": "https://example.com/workflow-guide",
            "verification_level": "official",
            "status": "published",
        },
    ).json()
    first = client.post(
        f"/api/v1/signals/{signal['slug']}/comments",
        headers=_headers(user_token),
        json={"kind": "tip", "content": "첫 번째 댓글입니다."},
    ).json()
    assert client.delete(
        f"/api/v1/signals/comments/{first['id']}", headers=_headers(user_token)
    ).status_code == 204

    second = client.post(
        f"/api/v1/signals/{signal['slug']}/comments",
        headers=_headers(user_token),
        json={"kind": "question", "content": "숨김 처리할 댓글입니다."},
    ).json()
    assert client.patch(
        f"/api/v1/signals/comments/{second['id']}/moderation",
        headers=_headers(admin_token),
        json={"hidden": True},
    ).status_code == 204
    assert client.get(f"/api/v1/signals/{signal['slug']}/comments").json() == []


def test_private_and_legacy_routes_remain_protected(client):
    _reset_db()
    _create_user("normal@jion.test", "normal-user")
    token = _login(client, "normal@jion.test")

    assert client.get("/api/v1/signals/review-queue", headers=_headers(token)).status_code == 403
    assert client.post("/api/v1/signals/", headers=_headers(token), json={}).status_code == 403
    assert client.patch(
        "/api/v1/signals/1/review", headers=_headers(token), json={"action": "hold"}
    ).status_code == 403
    assert client.get("/api/v1/posts/").status_code == 404
    assert client.get("/api/v1/mcp-servers/").status_code == 404
    assert client.get("/share/posts/1").status_code == 404


def test_interest_limits_are_validated(client):
    _reset_db()
    _create_user("interest@jion.test", "interest-user")
    token = _login(client, "interest@jion.test")

    too_many = client.put(
        "/api/v1/signals/me/interests",
        headers=_headers(token),
        json={"keywords": [f"keyword-{index}" for index in range(21)]},
    )
    assert too_many.status_code == 400
    too_long = client.put(
        "/api/v1/signals/me/interests",
        headers=_headers(token),
        json={"keywords": ["x" * 81]},
    )
    assert too_long.status_code == 400
