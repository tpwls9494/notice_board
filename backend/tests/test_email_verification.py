import hashlib
from datetime import datetime, timedelta, timezone

from app.api.v1 import auth as auth_api
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base, engine
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User


def _reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _create_unverified_user(email: str, username: str, password: str = "password123") -> User:
    with SessionLocal() as db:
        user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            has_local_password=True,
            email_verified=False,
            email_verified_at=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _login_user(client, email: str, password: str = "password123") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_signup_email_code_and_register_success(client, monkeypatch):
    _reset_db()
    captured = {"code": ""}

    def _fake_send_code_email(_to_email: str, code: str) -> None:
        captured["code"] = code

    monkeypatch.setattr(auth_api, "_send_signup_email_code_email", _fake_send_code_email)

    email = "flow-success@example.com"
    send_response = client.post(
        "/api/v1/auth/email-verification/send-code",
        json={"email": email},
    )
    assert send_response.status_code == 200
    assert captured["code"]

    confirm_response = client.post(
        "/api/v1/auth/email-verification/confirm-code",
        json={"email": email, "code": captured["code"]},
    )
    assert confirm_response.status_code == 200
    verification_ticket = confirm_response.json()["verification_ticket"]
    assert verification_ticket

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": "flow-user",
            "password": "password123",
            "email_verification_ticket": verification_ticket,
        },
    )
    assert register_response.status_code == 201
    assert register_response.json()["email_verified"] is True


def test_register_requires_verified_ticket(client):
    _reset_db()
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "no-ticket@example.com",
            "username": "no-ticket-user",
            "password": "password123",
            "email_verification_ticket": "invalid-ticket",
        },
    )

    assert register_response.status_code == 400
    assert "이메일 인증" in register_response.json()["detail"]


def test_unverified_user_cannot_create_post(client):
    _reset_db()
    user = _create_unverified_user("verify-block@example.com", "verify-block-user")
    with SessionLocal() as db:
        db.add(Category(name="일반", slug="general"))
        db.commit()
        category = db.query(Category).filter(Category.slug == "general").first()
        assert category is not None
        category_id = category.id

    access_token = _login_user(client, user.email)
    create_response = client.post(
        "/api/v1/posts/",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "title": "blocked",
            "content": "blocked",
            "category_id": category_id,
        },
    )

    assert create_response.status_code == 403
    assert "이메일 인증" in create_response.json()["detail"]


def test_verify_email_expired_and_reuse(client):
    _reset_db()
    email = "verify-token@example.com"
    user = _create_unverified_user(email, "verify-token-user")

    raw_token = "known-token-success"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    with SessionLocal() as db:
        db.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
        )
        db.commit()

    verify_response = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert verify_response.status_code == 200

    reused_response = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert reused_response.status_code == 400
    assert "유효하지 않거나 만료된" in reused_response.json()["detail"]

    expired_token = "known-token-expired"
    expired_hash = hashlib.sha256(expired_token.encode("utf-8")).hexdigest()
    with SessionLocal() as db:
        db.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=expired_hash,
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            )
        )
        db.commit()

    expired_response = client.post("/api/v1/auth/verify-email", json={"token": expired_token})
    assert expired_response.status_code == 400
    assert "유효하지 않거나 만료된" in expired_response.json()["detail"]


def test_resend_verification_rate_limit_returns_same_response(client, monkeypatch):
    _reset_db()
    _create_unverified_user("resend-rate@example.com", "resend-rate-user")

    auth_api._EMAIL_RESEND_ATTEMPTS_BY_KEY.clear()
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_RESEND_MAX_ATTEMPTS", 1)
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS", 3600)

    sent_count = {"value": 0}

    def _fake_send_verification(_db, _user):
        sent_count["value"] += 1

    monkeypatch.setattr(auth_api, "_send_email_verification_for_user", _fake_send_verification)

    first = client.post("/api/v1/auth/resend-verification", json={"email": "resend-rate@example.com"})
    second = client.post("/api/v1/auth/resend-verification", json={"email": "resend-rate@example.com"})
    missing = client.post("/api/v1/auth/resend-verification", json={"email": "missing@example.com"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert missing.status_code == 200
    assert first.json() == second.json() == missing.json()
    assert sent_count["value"] == 1
