import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.api.v1 import auth, posts, comments, categories, likes, files, community
from app.api.v1 import mcp_servers, mcp_categories, mcp_reviews, mcp_playground
from app.db.base import Base, engine
from app.db.session import SessionLocal
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import McpCategory, McpServer, McpTool, McpReview, McpInstallGuide, PlaygroundUsage  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.post import Post  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.comment import Comment  # noqa: F401
from app.models.like import Like  # noqa: F401
from app.models.file import File  # noqa: F401
from app.models.bookmark import Bookmark  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.services.github_sync import sync_all_github_stats

logger = logging.getLogger(__name__)
ROOT_ADMIN_USERNAME = "root"
ROOT_ADMIN_PASSWORD = "root1234"
ROOT_ADMIN_EMAIL = "root@jion.local"

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="jion MCP Marketplace API",
    description="MCP 마켓플레이스 & 커뮤니티 API",
    version="2.0.0",
)

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle validation errors with user-friendly messages
    """
    errors = exc.errors()

    # Check for common validation errors and provide friendly messages
    for error in errors:
        field = error.get("loc", [])[-1] if error.get("loc") else "field"
        error_type = error.get("type", "")

        # Email validation error
        if error_type == "value_error.email" or "email" in str(error_type):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "올바른 이메일 형식을 입력해주세요 (예: user@example.com)"}
            )

        # String too short
        if "string_too_short" in error_type:
            min_length = error.get("ctx", {}).get("limit_value", "")
            if field == "password":
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": f"비밀번호는 최소 {min_length}자 이상이어야 합니다"}
                )
            elif field == "username":
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": f"사용자명은 최소 {min_length}자 이상이어야 합니다"}
                )

        # Missing field
        if error_type == "value_error.missing":
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": f"{field} 필드는 필수입니다"}
            )

    # Default validation error message
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "입력 정보를 확인해주세요"}
    )


# CORS settings
origins = settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(comments.router, prefix="/api/v1/comments", tags=["comments"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
app.include_router(likes.router, prefix="/api/v1/likes", tags=["likes"])
app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(community.router, prefix="/api/v1/community", tags=["community"])

# MCP Marketplace routers
app.include_router(mcp_categories.router, prefix="/api/v1/mcp-categories", tags=["mcp-categories"])
app.include_router(mcp_servers.router, prefix="/api/v1/mcp-servers", tags=["mcp-servers"])
app.include_router(mcp_reviews.router, prefix="/api/v1/mcp-reviews", tags=["mcp-reviews"])
app.include_router(mcp_playground.router, prefix="/api/v1/mcp-playground", tags=["mcp-playground"])


def ensure_root_admin_user(db: Session) -> None:
    root_user = db.query(User).filter(User.username == ROOT_ADMIN_USERNAME).first()
    root_email_user = db.query(User).filter(User.email == ROOT_ADMIN_EMAIL).first()

    def sync_root_credentials(target_user: User) -> bool:
        updated_local = False
        try:
            password_matches = verify_password(ROOT_ADMIN_PASSWORD, target_user.hashed_password)
        except Exception:
            password_matches = False

        if not password_matches:
            target_user.hashed_password = get_password_hash(ROOT_ADMIN_PASSWORD)
            updated_local = True

        if not target_user.is_admin:
            target_user.is_admin = True
            updated_local = True

        return updated_local

    if root_user:
        updated = sync_root_credentials(root_user)

        # 기존 root 계정 이메일이 다르면 root@jion.local로 정규화합니다.
        if root_user.email != ROOT_ADMIN_EMAIL:
            if root_email_user is None or root_email_user.id == root_user.id:
                root_user.email = ROOT_ADMIN_EMAIL
                updated = True
            else:
                # 충돌 시에도 root@jion.local 로그인은 가능하도록 해당 이메일 계정 권한/비밀번호를 동기화합니다.
                if sync_root_credentials(root_email_user):
                    updated = True
                logger.warning(
                    "Could not assign '%s' to username 'root' because email is used by user id=%s.",
                    ROOT_ADMIN_EMAIL,
                    root_email_user.id,
                )

        if updated:
            db.commit()
            logger.info("Updated existing 'root' admin credentials.")
        return

    if root_email_user:
        updated = sync_root_credentials(root_email_user)
        if root_email_user.username != ROOT_ADMIN_USERNAME:
            root_username_owner = db.query(User).filter(User.username == ROOT_ADMIN_USERNAME).first()
            if root_username_owner is None or root_username_owner.id == root_email_user.id:
                root_email_user.username = ROOT_ADMIN_USERNAME
                updated = True
            else:
                logger.warning(
                    "Email '%s' exists but username 'root' is used by user id=%s.",
                    ROOT_ADMIN_EMAIL,
                    root_username_owner.id,
                )
        if updated:
            db.commit()
            logger.info("Updated existing user with root email to admin credentials.")
        return

    db.add(
        User(
            email=ROOT_ADMIN_EMAIL,
            username=ROOT_ADMIN_USERNAME,
            hashed_password=get_password_hash(ROOT_ADMIN_PASSWORD),
            is_admin=True,
        )
    )
    db.commit()
    logger.info("Created default root admin user.")


@app.on_event("startup")
async def startup_sync_github():
    db = SessionLocal()
    try:
        try:
            ensure_root_admin_user(db)
        except Exception as e:
            db.rollback()
            logger.warning(f"Root admin bootstrap failed: {e}")

        try:
            await sync_all_github_stats(db)
        except Exception as e:
            logger.warning(f"GitHub sync on startup failed: {e}")
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
