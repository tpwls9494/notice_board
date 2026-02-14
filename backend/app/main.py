import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api.v1 import auth, posts, comments, categories, likes, files, community
from app.api.v1 import mcp_servers, mcp_categories, mcp_reviews, mcp_playground
from app.db.base import Base, engine
from app.db.session import SessionLocal
from app.core.config import settings
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


@app.on_event("startup")
async def startup_sync_github():
    db = SessionLocal()
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
