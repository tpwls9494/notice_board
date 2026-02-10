from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, posts, comments, categories, likes, files, deadline_posts, qa
from app.db.base import Base, engine
from app.core.config import settings

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Company Board API",
    description="사내 게시판 API",
    version="1.0.0",
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
app.include_router(deadline_posts.router, prefix="/api/v1/deadline-posts", tags=["deadline-posts"])
app.include_router(qa.router, prefix="/api/v1/qa", tags=["qa"])


@app.get("/")
def root():
    return {"message": "Company Board API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
