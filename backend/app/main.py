import logging
import time

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.v1 import auth, bookmarks, categories, comments, community, files, likes, notifications, posts
from app.api.v1 import mcp_categories, mcp_playground, mcp_reviews, mcp_servers
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.session import SessionLocal
from app.models.user import User
from app.services.github_sync import sync_all_github_stats

logger = logging.getLogger(__name__)

docs_url = "/docs" if settings.API_DOCS_ENABLED else None
redoc_url = "/redoc" if settings.API_DOCS_ENABLED else None
openapi_url = "/openapi.json" if settings.API_DOCS_ENABLED else None

app = FastAPI(
    title="jion MCP Marketplace API",
    description="MCP Marketplace and community API",
    version="2.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)


@app.middleware("http")
async def request_metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        if settings.REQUEST_LOG_ENABLED:
            logger.exception(
                "request_error method=%s path=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                duration_ms,
            )
        raise

    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

    if settings.REQUEST_LOG_ENABLED:
        log_fn = logger.warning if duration_ms >= settings.SLOW_REQUEST_THRESHOLD_MS else logger.info
        log_fn(
            "request method=%s path=%s status=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return user-friendly validation messages."""
    _ = request
    errors = exc.errors()

    for error in errors:
        field = error.get("loc", [])[-1] if error.get("loc") else "field"
        error_type = error.get("type", "")

        if error_type == "value_error.email" or "email" in str(error_type):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "detail": "Please enter a valid email address (example: user@example.com)."
                },
            )

        if "string_too_short" in error_type:
            min_length = error.get("ctx", {}).get("limit_value", "")
            if field == "password":
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "detail": f"Password must be at least {min_length} characters long."
                    },
                )
            if field == "username":
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "detail": f"Username must be at least {min_length} characters long."
                    },
                )

        if error_type == "value_error.missing":
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": f"Missing required field: {field}"},
            )

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "Invalid input data."},
    )


origins = settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(comments.router, prefix="/api/v1/comments", tags=["comments"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
app.include_router(likes.router, prefix="/api/v1/likes", tags=["likes"])
app.include_router(bookmarks.router, prefix="/api/v1/bookmarks", tags=["bookmarks"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(community.router, prefix="/api/v1/community", tags=["community"])
app.include_router(
    mcp_categories.router, prefix="/api/v1/mcp-categories", tags=["mcp-categories"]
)
app.include_router(mcp_servers.router, prefix="/api/v1/mcp-servers", tags=["mcp-servers"])
app.include_router(mcp_reviews.router, prefix="/api/v1/mcp-reviews", tags=["mcp-reviews"])
app.include_router(
    mcp_playground.router, prefix="/api/v1/mcp-playground", tags=["mcp-playground"]
)


def ensure_bootstrap_admin_user(db: Session) -> None:
    email = settings.BOOTSTRAP_ADMIN_EMAIL
    username = settings.BOOTSTRAP_ADMIN_USERNAME
    password = settings.BOOTSTRAP_ADMIN_PASSWORD

    if not all([email, username, password]):
        logger.info(
            "Admin bootstrap skipped. Set BOOTSTRAP_ADMIN_EMAIL/USERNAME/PASSWORD to enable it."
        )
        return

    user_by_email = db.query(User).filter(User.email == email).first()
    user_by_username = db.query(User).filter(User.username == username).first()

    if user_by_email and user_by_username and user_by_email.id != user_by_username.id:
        logger.error(
            "Admin bootstrap aborted: email '%s' and username '%s' belong to different users.",
            email,
            username,
        )
        return

    target_user = user_by_email or user_by_username

    if target_user:
        updated = False
        if target_user.email != email:
            target_user.email = email
            updated = True
        if target_user.username != username:
            target_user.username = username
            updated = True
        try:
            password_matches = verify_password(password, target_user.hashed_password)
        except Exception:
            password_matches = False
        if not password_matches:
            target_user.hashed_password = get_password_hash(password)
            updated = True
        if not target_user.is_admin:
            target_user.is_admin = True
            updated = True
        if updated:
            db.commit()
            logger.info("Bootstrap admin account updated.")
        return

    db.add(
        User(
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            is_admin=True,
        )
    )
    db.commit()
    logger.info("Bootstrap admin account created.")


def ensure_performance_indexes(db: Session) -> None:
    """Create critical read-path indexes if they do not exist."""
    index_statements = [
        "CREATE INDEX IF NOT EXISTS ix_posts_created_at ON posts (created_at)",
        "CREATE INDEX IF NOT EXISTS ix_posts_category_id ON posts (category_id)",
        "CREATE INDEX IF NOT EXISTS ix_posts_category_created_at ON posts (category_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_posts_is_pinned_pinned_order_created_at ON posts (is_pinned, pinned_order, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_comments_post_id ON comments (post_id)",
        "CREATE INDEX IF NOT EXISTS ix_comments_post_created_at ON comments (post_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_bookmarks_user_id ON bookmarks (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at ON notifications (user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_is_read ON notifications (user_id, is_read)",
    ]

    for statement in index_statements:
        db.execute(text(statement))
    db.commit()


@app.on_event("startup")
async def startup_sync_github():
    db = SessionLocal()
    try:
        try:
            ensure_performance_indexes(db)
        except Exception as exc:
            db.rollback()
            logger.warning("Performance index bootstrap failed: %s", exc)

        try:
            ensure_bootstrap_admin_user(db)
        except Exception as exc:
            db.rollback()
            logger.warning("Admin bootstrap failed: %s", exc)

        try:
            await sync_all_github_stats(db)
        except Exception as exc:
            logger.warning("GitHub sync on startup failed: %s", exc)
    finally:
        db.close()


@app.on_event("shutdown")
async def shutdown_mcp_connections():
    from app.services.mcp_client import playground_service

    await playground_service.shutdown()


@app.get("/")
def root():
    return {"message": "jion MCP Marketplace API", "version": "2.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/detailed")
def detailed_health():
    db_status = "ok"
    db_error = None

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "error"
        db_error = str(exc)
    finally:
        db.close()

    service_status = "healthy" if db_status == "ok" else "degraded"
    payload = {
        "status": service_status,
        "checks": {
            "database": db_status,
        },
    }
    if db_error:
        payload["checks"]["database_error"] = db_error
    return payload
