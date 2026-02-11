from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, posts, comments, categories, likes, files
from app.api.v1 import mcp_servers, mcp_categories, mcp_reviews, mcp_playground
from app.db.base import Base, engine
from app.core.config import settings
from app.models import McpCategory, McpServer, McpTool, McpReview, McpInstallGuide  # noqa: F401

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Antigravity MCP Marketplace API",
    description="MCP 마켓플레이스 & 커뮤니티 API",
    version="2.0.0",
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

# MCP Marketplace routers
app.include_router(mcp_categories.router, prefix="/api/v1/mcp-categories", tags=["mcp-categories"])
app.include_router(mcp_servers.router, prefix="/api/v1/mcp-servers", tags=["mcp-servers"])
app.include_router(mcp_reviews.router, prefix="/api/v1/mcp-reviews", tags=["mcp-reviews"])
app.include_router(mcp_playground.router, prefix="/api/v1/mcp-playground", tags=["mcp-playground"])


@app.get("/")
def root():
    return {"message": "Antigravity MCP Marketplace API", "version": "2.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
