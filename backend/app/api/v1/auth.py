import logging
import hashlib
import smtplib
import threading
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import mimetypes
import os
import re
import secrets
import uuid
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl, quote_plus

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status, File as FastAPIFile
from fastapi.responses import FileResponse, RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import and_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import (
    EmailVerificationRequest,
    ResendVerificationRequest,
    SignupEmailCodeConfirmRequest,
    SignupEmailCodeSendRequest,
    UserCreate,
    UserLogin,
    UserResponse,
    UserNicknameUpdate,
    UserPasswordUpdate,
    Token,
)
from app.core.security import create_access_token, verify_password
from app.core.config import settings
from app.core.security import get_password_hash
from app.crud import user as crud_user
from app.api.deps import get_current_user
from app.models.email_verification_token import EmailVerificationToken
from app.models.signup_email_verification import SignupEmailVerification
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

PROFILE_IMAGE_DIR = "/app/uploads/profile_images"
PROFILE_IMAGE_URL_PREFIX = "/api/v1/auth/profile-images"
MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_PROFILE_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}
MIME_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
os.makedirs(PROFILE_IMAGE_DIR, exist_ok=True)
OAUTH_STATE_TTL_SECONDS = 600
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"
EMAIL_VERIFICATION_RESEND_RESPONSE = {
    "detail": "계정이 존재하고 인증이 필요하면 인증 메일을 발송했습니다.",
}
SIGNUP_CODE_SEND_RESPONSE = {
    "detail": "입력한 이메일로 인증 코드를 발송했습니다. 메일함을 확인해 주세요.",
}
SIGNUP_VERIFICATION_TICKET_PURPOSE = "signup_email_verified"
_EMAIL_RESEND_ATTEMPTS_BY_KEY: dict[str, list[datetime]] = {}
_EMAIL_RESEND_ATTEMPTS_LOCK = threading.Lock()
_SIGNUP_CODE_SEND_ATTEMPTS_BY_KEY: dict[str, list[datetime]] = {}
_SIGNUP_CODE_SEND_ATTEMPTS_LOCK = threading.Lock()
_SIGNUP_CODE_CONFIRM_ATTEMPTS_BY_KEY: dict[str, list[datetime]] = {}
_SIGNUP_CODE_CONFIRM_ATTEMPTS_LOCK = threading.Lock()


def _hash_email_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _email_verification_frontend_base_url() -> str:
    configured = (settings.EMAIL_VERIFICATION_FRONTEND_BASE_URL or "").strip()
    candidate = configured or settings.OAUTH_FRONTEND_DEFAULT_REDIRECT
    parsed = urlparse(candidate)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return "http://localhost:5173"


def _build_email_verification_url(token: str) -> str:
    frontend_base = _email_verification_frontend_base_url().rstrip("/")
    return f"{frontend_base}/verify-email?token={quote_plus(token)}"


def _send_email_verification_email(to_email: str, verification_url: str) -> None:
    smtp_host = (settings.SMTP_HOST or "").strip()
    from_email = (settings.SMTP_FROM_EMAIL or "").strip()
    if not smtp_host or not from_email:
        logger.warning("SMTP is not configured. Verification email skipped for %s", to_email)
        logger.info("Email verification URL for %s: %s", to_email, verification_url)
        return

    message = EmailMessage()
    sender_name = (settings.SMTP_FROM_NAME or "jion").strip()
    message["Subject"] = "[jion] Verify your email address"
    message["From"] = f"{sender_name} <{from_email}>" if sender_name else from_email
    message["To"] = to_email
    message.set_content(
        "Welcome to jion!\n\n"
        "Please verify your email by opening the link below.\n"
        f"{verification_url}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hours."
    )

    smtp_port = settings.SMTP_PORT
    smtp_username = (settings.SMTP_USERNAME or "").strip()
    smtp_password = settings.SMTP_PASSWORD or ""

    try:
        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to send email verification mail to %s: %s", to_email, exc)
        logger.info("Email verification URL for %s: %s", to_email, verification_url)


def _issue_email_verification_token(db: Session, user: User) -> str | None:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_TTL_HOURS)

    for _ in range(3):
        raw_token = secrets.token_urlsafe(48)
        token_hash = _hash_email_verification_token(raw_token)
        if db.query(EmailVerificationToken.id).filter(EmailVerificationToken.token_hash == token_hash).first():
            continue

        db_token = EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(db_token)
        try:
            db.commit()
            return raw_token
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.warning("Failed to issue email verification token for user_id=%s: %s", user.id, exc)
            return None

    logger.warning("Failed to issue email verification token due to repeated collisions for user_id=%s", user.id)
    return None


def _send_email_verification_for_user(db: Session, user: User) -> None:
    raw_token = _issue_email_verification_token(db, user)
    if not raw_token:
        return
    verification_url = _build_email_verification_url(raw_token)
    _send_email_verification_email(user.email, verification_url)


def _request_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()[:64] or "unknown"
    if request.client and request.client.host:
        return request.client.host[:64]
    return "unknown"


def _consume_sliding_window_rate_limit(
    bucket: dict[str, list[datetime]],
    lock: threading.Lock,
    key: str,
    max_attempts: int,
    window_seconds: int,
) -> bool:
    now = datetime.now(timezone.utc)
    window = timedelta(seconds=window_seconds)
    with lock:
        attempts = bucket.get(key, [])
        attempts = [attempt for attempt in attempts if now - attempt <= window]

        if len(attempts) >= max_attempts:
            bucket[key] = attempts
            return False

        attempts.append(now)
        bucket[key] = attempts
        return True


def _consume_resend_rate_limit(request: Request, normalized_email: str) -> bool:
    key = f"{_request_ip(request)}:{normalized_email}"
    return _consume_sliding_window_rate_limit(
        bucket=_EMAIL_RESEND_ATTEMPTS_BY_KEY,
        lock=_EMAIL_RESEND_ATTEMPTS_LOCK,
        key=key,
        max_attempts=settings.EMAIL_VERIFICATION_RESEND_MAX_ATTEMPTS,
        window_seconds=settings.EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS,
    )


def _consume_signup_send_code_rate_limit(request: Request, normalized_email: str) -> bool:
    key = f"{_request_ip(request)}:{normalized_email}"
    return _consume_sliding_window_rate_limit(
        bucket=_SIGNUP_CODE_SEND_ATTEMPTS_BY_KEY,
        lock=_SIGNUP_CODE_SEND_ATTEMPTS_LOCK,
        key=key,
        max_attempts=settings.SIGNUP_EMAIL_SEND_MAX_ATTEMPTS,
        window_seconds=settings.SIGNUP_EMAIL_SEND_WINDOW_SECONDS,
    )


def _consume_signup_confirm_code_rate_limit(request: Request, normalized_email: str) -> bool:
    key = f"{_request_ip(request)}:{normalized_email}"
    return _consume_sliding_window_rate_limit(
        bucket=_SIGNUP_CODE_CONFIRM_ATTEMPTS_BY_KEY,
        lock=_SIGNUP_CODE_CONFIRM_ATTEMPTS_LOCK,
        key=key,
        max_attempts=settings.SIGNUP_EMAIL_CONFIRM_MAX_ATTEMPTS,
        window_seconds=settings.SIGNUP_EMAIL_CONFIRM_WINDOW_SECONDS,
    )


def _generate_signup_email_code() -> str:
    length = max(4, min(10, settings.SIGNUP_EMAIL_CODE_LENGTH))
    number = secrets.randbelow(10**length)
    return str(number).zfill(length)


def _hash_signup_email_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _build_signup_email_code_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.SIGNUP_EMAIL_CODE_TTL_MINUTES)


def _send_signup_email_code_email(to_email: str, code: str) -> None:
    smtp_host = (settings.SMTP_HOST or "").strip()
    from_email = (settings.SMTP_FROM_EMAIL or "").strip()
    if not smtp_host or not from_email:
        logger.warning("SMTP is not configured. Signup code email skipped for %s", to_email)
        logger.info("Signup email code for %s: %s", to_email, code)
        return

    message = EmailMessage()
    sender_name = (settings.SMTP_FROM_NAME or "jion").strip()
    message["Subject"] = "[jion] 이메일 인증 코드"
    message["From"] = f"{sender_name} <{from_email}>" if sender_name else from_email
    message["To"] = to_email
    message.set_content(
        "jion 회원가입 이메일 인증 코드입니다.\n\n"
        f"인증 코드: {code}\n\n"
        f"코드는 {settings.SIGNUP_EMAIL_CODE_TTL_MINUTES}분 뒤 만료됩니다."
    )

    smtp_port = settings.SMTP_PORT
    smtp_username = (settings.SMTP_USERNAME or "").strip()
    smtp_password = settings.SMTP_PASSWORD or ""

    try:
        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to send signup email code to %s: %s", to_email, exc)
        logger.info("Signup email code for %s: %s", to_email, code)


def _create_signup_verification_ticket(email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "purpose": SIGNUP_VERIFICATION_TICKET_PURPOSE,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(
            (
                now
                + timedelta(minutes=settings.SIGNUP_EMAIL_VERIFICATION_TICKET_TTL_MINUTES)
            ).timestamp()
        ),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _validate_signup_verification_ticket(ticket: str, email: str) -> bool:
    try:
        payload = jwt.decode(ticket, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return False

    if not isinstance(payload, dict):
        return False
    if payload.get("purpose") != SIGNUP_VERIFICATION_TICKET_PURPOSE:
        return False
    ticket_email = crud_user.normalize_email(str(payload.get("email") or ""))
    return ticket_email == crud_user.normalize_email(email)


def _remove_old_profile_image(profile_image_url: str | None) -> None:
    if not profile_image_url:
        return

    url_prefix = f"{PROFILE_IMAGE_URL_PREFIX}/"
    if not profile_image_url.startswith(url_prefix):
        return

    filename = profile_image_url[len(url_prefix):]
    if not SAFE_FILENAME_PATTERN.match(filename):
        return

    file_path = os.path.join(PROFILE_IMAGE_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            # 파일 삭제 실패는 요청 자체를 실패시키지 않습니다.
            pass


def _oauth_provider_enabled(provider: str) -> bool:
    if provider == "google":
        return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)
    if provider == "github":
        return bool(settings.GITHUB_OAUTH_CLIENT_ID and settings.GITHUB_OAUTH_CLIENT_SECRET)
    return False


def _build_public_origin(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",")[0].strip()
    host = forwarded_host or request.headers.get("host", "").strip() or request.url.netloc
    scheme = forwarded_proto or request.url.scheme
    return f"{scheme}://{host}"


def _build_backend_redirect_uri(request: Request, provider: str) -> str:
    return f"{_build_public_origin(request)}/api/v1/auth/oauth/{provider}/callback"


def _sanitize_next_path(raw_next: str | None) -> str:
    if not raw_next:
        return "/community"
    next_path = raw_next.strip()
    if not next_path.startswith("/") or next_path.startswith("//"):
        return "/community"
    return next_path[:500]


def _sanitize_frontend_redirect(request: Request, raw_redirect: str | None) -> str:
    fallback = settings.OAUTH_FRONTEND_DEFAULT_REDIRECT
    candidate = (raw_redirect or "").strip() or fallback
    parsed = urlparse(candidate)

    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return candidate

    if candidate.startswith("/"):
        return f"{_build_public_origin(request)}{candidate}"

    return fallback


def _append_query_params(url: str, params: dict[str, str]) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(params)
    return urlunparse(parsed._replace(query=urlencode(query)))


def _encode_oauth_state(provider: str, frontend_redirect: str, next_path: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "provider": provider,
        "frontend_redirect": frontend_redirect,
        "next": next_path,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=OAUTH_STATE_TTL_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_oauth_state(raw_state: str) -> dict:
    try:
        decoded = jwt.decode(raw_state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        ) from exc
    if not isinstance(decoded, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")
    return decoded


def _normalize_username_base(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", (value or "").strip())
    normalized = normalized.strip("-_").lower()
    if len(normalized) < 3:
        normalized = f"user-{secrets.token_hex(3)}"
    return normalized[:40]


def _make_unique_username(db: Session, base: str) -> str:
    safe_base = _normalize_username_base(base)
    for idx in range(0, 1000):
        candidate = safe_base if idx == 0 else f"{safe_base}-{idx}"
        candidate = candidate[:50]
        if not crud_user.get_user_by_username(db, candidate):
            return candidate
    return f"user-{secrets.token_hex(5)}"


def _get_or_create_oauth_user(
    db: Session,
    email: str,
    username_hint: str,
    email_verified: bool,
) -> User:
    normalized_email = crud_user.normalize_email(email)
    user = crud_user.get_user_by_email(db, normalized_email)
    if user:
        if email_verified and not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.now(timezone.utc)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    username = _make_unique_username(db, username_hint)
    random_password = secrets.token_urlsafe(24)
    user = User(
        email=normalized_email,
        username=username,
        hashed_password=get_password_hash(random_password),
        has_local_password=False,
        email_verified=email_verified,
        email_verified_at=datetime.now(timezone.utc) if email_verified else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _redirect_oauth_error(frontend_redirect: str, error_code: str) -> RedirectResponse:
    redirect_url = _append_query_params(frontend_redirect, {"error": error_code})
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


async def _fetch_google_profile(code: str, redirect_uri: str) -> tuple[str, str, bool]:
    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise RuntimeError("Google token response missing access_token")

        profile_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

    email = str(profile.get("email") or "").strip().lower()
    username_hint = str(profile.get("name") or profile.get("given_name") or email.split("@")[0] or "google-user")
    email_verified = bool(profile.get("email_verified"))
    return email, username_hint, email_verified


def _pick_github_email(email_rows: list[dict]) -> tuple[str, bool]:
    if not isinstance(email_rows, list):
        return "", False

    for row in email_rows:
        if isinstance(row, dict) and row.get("primary") and row.get("verified") and row.get("email"):
            return str(row["email"]).strip().lower(), True

    for row in email_rows:
        if isinstance(row, dict) and row.get("verified") and row.get("email"):
            return str(row["email"]).strip().lower(), True

    for row in email_rows:
        if isinstance(row, dict) and row.get("primary") and row.get("email"):
            return str(row["email"]).strip().lower(), False

    for row in email_rows:
        if isinstance(row, dict) and row.get("email"):
            return str(row["email"]).strip().lower(), False

    return "", False


async def _fetch_github_profile(code: str, redirect_uri: str) -> tuple[str, str, bool]:
    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GITHUB_OAUTH_CLIENT_ID,
                "client_secret": settings.GITHUB_OAUTH_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
            },
            headers={
                "Accept": "application/json",
                "User-Agent": "jion-oauth-client",
            },
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise RuntimeError("GitHub token response missing access_token")

        user_response = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "jion-oauth-client",
            },
        )
        user_response.raise_for_status()
        profile = user_response.json()

        email = str(profile.get("email") or "").strip().lower()
        email_verified = False
        try:
            emails_response = await client.get(
                GITHUB_EMAILS_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "jion-oauth-client",
                },
            )
            emails_response.raise_for_status()
            picked_email, picked_verified = _pick_github_email(emails_response.json())
            if picked_email:
                email = picked_email
                email_verified = picked_verified
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to fetch GitHub verified email list: %s", exc)

    username_hint = str(profile.get("login") or profile.get("name") or email.split("@")[0] or "github-user")
    return email, username_hint, email_verified


@router.post("/email-verification/send-code")
def send_signup_email_verification_code(
    payload: SignupEmailCodeSendRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = crud_user.normalize_email(str(payload.email))

    if not _consume_signup_send_code_rate_limit(request, normalized_email):
        return SIGNUP_CODE_SEND_RESPONSE

    # Do not disclose account existence.
    if crud_user.get_user_by_email(db, normalized_email):
        return SIGNUP_CODE_SEND_RESPONSE

    now = datetime.now(timezone.utc)
    db.query(SignupEmailVerification).filter(
        and_(
            SignupEmailVerification.email == normalized_email,
            SignupEmailVerification.used_at.is_(None),
        )
    ).update({"used_at": now}, synchronize_session=False)

    code = _generate_signup_email_code()
    db.add(
        SignupEmailVerification(
            email=normalized_email,
            code_hash=_hash_signup_email_code(code),
            expires_at=_build_signup_email_code_expiry(),
        )
    )
    db.commit()
    _send_signup_email_code_email(normalized_email, code)
    return SIGNUP_CODE_SEND_RESPONSE


@router.post("/email-verification/confirm-code")
def confirm_signup_email_verification_code(
    payload: SignupEmailCodeConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = crud_user.normalize_email(str(payload.email))
    if not _consume_signup_confirm_code_rate_limit(request, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증 코드가 올바르지 않거나 만료되었습니다.",
        )

    now = datetime.now(timezone.utc)
    code_hash = _hash_signup_email_code(payload.code.strip())
    db_code = (
        db.query(SignupEmailVerification)
        .filter(
            and_(
                SignupEmailVerification.email == normalized_email,
                SignupEmailVerification.code_hash == code_hash,
                SignupEmailVerification.used_at.is_(None),
            )
        )
        .order_by(SignupEmailVerification.created_at.desc())
        .first()
    )

    if not db_code or _to_utc(db_code.expires_at) <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증 코드가 올바르지 않거나 만료되었습니다.",
        )

    db_code.used_at = now
    db.add(db_code)
    db.commit()

    return {
        "detail": "이메일 인증이 완료되었습니다.",
        "verification_ticket": _create_signup_verification_ticket(normalized_email),
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    normalized_email = crud_user.normalize_email(str(user.email))
    normalized_username = crud_user.normalize_username(user.username)
    if len(normalized_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long",
        )

    # Check if user already exists
    if crud_user.get_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다.",
        )
    if crud_user.get_user_by_username(db, normalized_username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다.",
        )

    if not _validate_signup_verification_ticket(user.email_verification_ticket, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이메일 인증을 먼저 완료해 주세요.",
        )

    # Create user
    db_user = crud_user.create_user(
        db,
        user.model_copy(update={"email": normalized_email, "username": normalized_username}),
        email_verified=True,
    )
    return db_user


@router.post("/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = crud_user.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/verify-email")
def verify_email(payload: EmailVerificationRequest, db: Session = Depends(get_db)):
    token_hash = _hash_email_verification_token(payload.token.strip())
    now = datetime.now(timezone.utc)

    db_token = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_hash)
        .first()
    )
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 토큰입니다.",
        )

    if db_token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 토큰입니다.",
        )

    if _to_utc(db_token.expires_at) <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 토큰입니다.",
        )

    user = crud_user.get_user_by_id(db, db_token.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 토큰입니다.",
        )

    db_token.used_at = now
    user.email_verified = True
    user.email_verified_at = now

    db.add(db_token)
    db.add(user)
    db.query(EmailVerificationToken).filter(
        and_(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.id != db_token.id,
        )
    ).update({"used_at": now}, synchronize_session=False)
    db.commit()

    return {"detail": "이메일 인증이 완료되었습니다."}


@router.post("/resend-verification")
def resend_verification_email(
    payload: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = crud_user.normalize_email(payload.email)
    if not _consume_resend_rate_limit(request, normalized_email):
        return EMAIL_VERIFICATION_RESEND_RESPONSE

    user = crud_user.get_user_by_email(db, normalized_email)
    if not user or user.email_verified:
        return EMAIL_VERIFICATION_RESEND_RESPONSE

    _send_email_verification_for_user(db, user)
    return EMAIL_VERIFICATION_RESEND_RESPONSE


@router.get("/oauth/providers")
def get_oauth_providers():
    return {
        "google": _oauth_provider_enabled("google"),
        "github": _oauth_provider_enabled("github"),
    }


@router.get("/oauth/{provider}/start", include_in_schema=False)
def oauth_start(
    provider: str,
    request: Request,
    redirect: str | None = Query(default=None, description="Frontend callback URL"),
    next: str | None = Query(default="/community", description="Post-login path in frontend"),
):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported OAuth provider")

    if not _oauth_provider_enabled(provider):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"{provider} OAuth is not configured")

    frontend_redirect = _sanitize_frontend_redirect(request, redirect)
    next_path = _sanitize_next_path(next)
    redirect_uri = _build_backend_redirect_uri(request, provider)
    state = _encode_oauth_state(provider, frontend_redirect, next_path)

    if provider == "google":
        authorize_url = f"{GOOGLE_AUTH_URL}?{urlencode({'client_id': settings.GOOGLE_OAUTH_CLIENT_ID, 'redirect_uri': redirect_uri, 'response_type': 'code', 'scope': 'openid email profile', 'state': state, 'prompt': 'select_account'})}"
    else:
        authorize_url = f"{GITHUB_AUTH_URL}?{urlencode({'client_id': settings.GITHUB_OAUTH_CLIENT_ID, 'redirect_uri': redirect_uri, 'scope': 'read:user user:email', 'state': state})}"

    return RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)


@router.get("/oauth/{provider}/callback", include_in_schema=False)
async def oauth_callback(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    fallback_frontend_redirect = _sanitize_frontend_redirect(request, None)

    if provider not in {"google", "github"}:
        return _redirect_oauth_error(fallback_frontend_redirect, "unsupported_provider")

    if error:
        return _redirect_oauth_error(fallback_frontend_redirect, "oauth_access_denied")

    if not code or not state:
        return _redirect_oauth_error(fallback_frontend_redirect, "oauth_missing_code")

    try:
        state_payload = _decode_oauth_state(state)
    except HTTPException:
        return _redirect_oauth_error(fallback_frontend_redirect, "oauth_invalid_state")

    frontend_redirect = _sanitize_frontend_redirect(request, str(state_payload.get("frontend_redirect") or ""))
    next_path = _sanitize_next_path(str(state_payload.get("next") or "/community"))

    if state_payload.get("provider") != provider:
        return _redirect_oauth_error(frontend_redirect, "oauth_provider_mismatch")

    if not _oauth_provider_enabled(provider):
        return _redirect_oauth_error(frontend_redirect, "oauth_not_configured")

    redirect_uri = _build_backend_redirect_uri(request, provider)

    try:
        if provider == "google":
            email, username_hint, provider_email_verified = await _fetch_google_profile(code, redirect_uri)
        else:
            email, username_hint, provider_email_verified = await _fetch_github_profile(code, redirect_uri)
    except Exception as exc:  # noqa: BLE001
        logger.warning("OAuth callback failed for provider=%s: %s", provider, exc)
        return _redirect_oauth_error(frontend_redirect, "oauth_exchange_failed")

    if not email:
        return _redirect_oauth_error(frontend_redirect, "oauth_email_missing")

    try:
        user = _get_or_create_oauth_user(
            db,
            email=email,
            username_hint=username_hint,
            email_verified=provider_email_verified,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("OAuth user upsert failed for provider=%s email=%s: %s", provider, email, exc)
        return _redirect_oauth_error(frontend_redirect, "oauth_user_upsert_failed")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
    )

    success_redirect = _append_query_params(
        frontend_redirect,
        {
            "token": access_token,
            "next": next_path,
            "provider": provider,
        },
    )
    return RedirectResponse(url=success_redirect, status_code=status.HTTP_302_FOUND)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/profile", response_model=UserResponse)
def update_me_profile(
    profile: UserNicknameUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_username = crud_user.normalize_username(profile.username)

    if len(new_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long",
        )

    existing_user = crud_user.get_user_by_username(db, new_username)
    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    updated_user = crud_user.update_username(db, current_user, new_username)
    return updated_user


@router.patch("/me/password")
def update_me_password(
    password_update: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.has_local_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change is not available for social login accounts",
        )

    if not verify_password(password_update.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if password_update.current_password == password_update.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    crud_user.update_password(db, current_user, password_update.new_password)
    return {"detail": "Password updated successfully"}


@router.post("/me/profile-image", response_model=UserResponse)
async def upload_me_profile_image(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_PROFILE_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, GIF, and WEBP images are allowed",
        )

    content = await file.read()
    file_size = len(content)
    if file_size > MAX_PROFILE_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be 5MB or smaller",
        )

    original_extension = os.path.splitext(file.filename or "")[1].lower()
    file_extension = (
        original_extension
        if original_extension in {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        else MIME_TO_EXTENSION[file.content_type]
    )

    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(PROFILE_IMAGE_DIR, unique_filename)

    try:
        with open(file_path, "wb") as output_file:
            output_file.write(content)
    except Exception as exc:
        logger.exception("Profile image write failed for user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save profile image",
        )

    old_profile_image_url = current_user.profile_image_url
    new_profile_image_url = f"{PROFILE_IMAGE_URL_PREFIX}/{unique_filename}"

    updated_user = crud_user.update_profile_image_url(db, current_user, new_profile_image_url)

    if old_profile_image_url and old_profile_image_url != new_profile_image_url:
        _remove_old_profile_image(old_profile_image_url)

    return updated_user


@router.get("/profile-images/{filename}")
def get_profile_image(filename: str):
    if not SAFE_FILENAME_PATTERN.match(filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )

    file_path = os.path.join(PROFILE_IMAGE_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found",
        )

    media_type, _ = mimetypes.guess_type(file_path)
    return FileResponse(path=file_path, media_type=media_type or "application/octet-stream")
