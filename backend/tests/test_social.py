from app.api.v1.social import comment_write_limiter, post_write_limiter
from app.core.security import get_password_hash
from app.db.base import Base, engine
from app.db.session import SessionLocal
from app.models.user import User


def _reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    post_write_limiter.clear()
    comment_write_limiter.clear()


def _create_user(email: str, username: str, *, admin: bool = False) -> int:
    with SessionLocal() as db:
        user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash("password123"),
            has_local_password=True,
            email_verified=True,
            is_admin=admin,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id


def _login(client, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_social_post_crud_recommend_follow_and_space_separation(client):
    _reset_db()
    author_id = _create_user("author@social.test", "story-author")
    _create_user("reader@social.test", "story-reader")
    author_headers = _login(client, "author@social.test")
    reader_headers = _login(client, "reader@social.test")

    created = client.post(
        "/api/v1/community/posts",
        headers=author_headers,
        json={
            "title": "작은 모델을 직접 실행해본 기록",
            "content": "같은 프롬프트를 여러 모델에서 실행하고 차이를 비교했습니다.",
            "space": "community",
            "topic": "experience",
            "tags": ["SLM", "실험"],
        },
    )
    assert created.status_code == 201
    post = created.json()

    lounge = client.post(
        "/api/v1/community/posts",
        headers=author_headers,
        json={"title": "오늘도 반갑습니다", "content": "잠깐 쉬었다 가세요.", "space": "lounge", "topic": "chat"},
    )
    assert lounge.status_code == 201
    assert client.get("/api/v1/community/posts?space=community").json()["total"] == 1
    assert client.get("/api/v1/community/posts?space=lounge").json()["total"] == 1

    updated = client.patch(
        f"/api/v1/community/posts/{post['id']}",
        headers=author_headers,
        json={"title": "작은 모델을 직접 비교해본 기록"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"].endswith("기록")

    assert client.post(f"/api/v1/community/posts/{post['id']}/recommend", headers=reader_headers).status_code == 204
    detail = client.get(f"/api/v1/community/posts/{post['id']}", headers=reader_headers)
    assert detail.json()["recommendation_count"] == 1
    assert detail.json()["is_recommended"] is True

    assert client.post(f"/api/v1/follows/users/{author_id}", headers=reader_headers).status_code == 201
    following = client.get(
        "/api/v1/community/posts?space=community&sort=following",
        headers=reader_headers,
    )
    assert following.status_code == 200
    assert following.json()["total"] == 1

    assert client.delete(f"/api/v1/community/posts/{post['id']}", headers=author_headers).status_code == 204
    assert client.get(f"/api/v1/community/posts/{post['id']}").status_code == 404


def test_social_comments_support_replies_edit_delete_and_recommend(client):
    _reset_db()
    _create_user("writer@social.test", "comment-writer")
    _create_user("reply@social.test", "reply-writer")
    writer_headers = _login(client, "writer@social.test")
    reply_headers = _login(client, "reply@social.test")
    post = client.post(
        "/api/v1/community/posts",
        headers=writer_headers,
        json={"title": "대댓글 동작 확인", "content": "댓글과 대댓글을 확인합니다.", "space": "community", "topic": "question"},
    ).json()

    root = client.post(
        f"/api/v1/community/posts/{post['id']}/comments",
        headers=writer_headers,
        json={"content": "첫 댓글입니다."},
    ).json()
    reply = client.post(
        f"/api/v1/community/posts/{post['id']}/comments",
        headers=reply_headers,
        json={"content": "첫 번째 답글입니다.", "parent_id": root["id"]},
    ).json()
    nested_reply = client.post(
        f"/api/v1/community/posts/{post['id']}/comments",
        headers=writer_headers,
        json={"content": "답글에 남긴 답글입니다.", "parent_id": reply["id"]},
    ).json()
    assert reply["parent_id"] == root["id"]
    assert nested_reply["parent_id"] == root["id"]

    edited = client.patch(
        f"/api/v1/community/comments/{reply['id']}",
        headers=reply_headers,
        json={"content": "수정된 답글입니다."},
    )
    assert edited.status_code == 200
    assert edited.json()["content"] == "수정된 답글입니다."
    assert client.post(
        f"/api/v1/community/comments/{reply['id']}/recommend",
        headers=writer_headers,
    ).status_code == 204

    assert client.delete(f"/api/v1/community/comments/{root['id']}", headers=writer_headers).status_code == 204
    comments = client.get(f"/api/v1/community/posts/{post['id']}/comments", headers=writer_headers).json()
    deleted_root = next(item for item in comments if item["id"] == root["id"])
    recommended_reply = next(item for item in comments if item["id"] == reply["id"])
    assert deleted_root["is_deleted"] is True
    assert deleted_root["content"] == "삭제된 댓글입니다."
    assert recommended_reply["recommendation_count"] == 1
