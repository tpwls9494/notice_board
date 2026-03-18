import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_admin, get_current_user_optional
from app.crud import blog_post as crud_blog
from app.crud import blog_category as crud_blog_cat
from app.db.session import get_db
from app.models.user import User
from app.schemas.blog_post import (
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostListItem,
    BlogPostResponse,
    BlogPostUpdate,
)
from app.schemas.blog_category import BlogCategoryCreate, BlogCategoryResponse

router = APIRouter()
logger = logging.getLogger(__name__)

BLOG_UPLOAD_DIR = "/app/uploads/blog"
os.makedirs(BLOG_UPLOAD_DIR, exist_ok=True)

BLOG_MAX_FILE_SIZE = 10 * 1024 * 1024
BLOG_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@router.get("/categories", response_model=list[BlogCategoryResponse])
def get_blog_categories(db: Session = Depends(get_db)):
    categories = crud_blog_cat.get_blog_categories(db)
    return [BlogCategoryResponse.model_validate(c) for c in categories]


@router.post("/categories", response_model=BlogCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_blog_category(
    body: BlogCategoryCreate,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db),
):
    from app.models.blog_category import BlogCategory

    existing = db.query(BlogCategory).filter(BlogCategory.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 카테고리입니다.")
    category = crud_blog_cat.create_blog_category(db, body.name)
    return BlogCategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_category(
    category_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db),
):
    if not crud_blog_cat.delete_blog_category(db, category_id):
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")


@router.get("/", response_model=BlogPostListResponse)
def get_blog_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    posts, total = crud_blog.get_blog_posts(
        db, page=page, page_size=page_size, search=search, tag=tag, published_only=True
    )
    return BlogPostListResponse(
        items=[BlogPostListItem.model_validate(p) for p in posts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/drafts", response_model=BlogPostListResponse)
def get_drafts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db),
):
    posts, total = crud_blog.get_blog_posts(
        db, page=page, page_size=page_size, drafts_only=True
    )
    return BlogPostListResponse(
        items=[BlogPostListItem.model_validate(p) for p in posts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/images/{filename}")
async def serve_blog_image(filename: str):
    """Serve an uploaded blog image."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(BLOG_UPLOAD_DIR, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(file_path)


@router.get("/{slug}", response_model=BlogPostResponse)
def get_blog_post(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    post = crud_blog.get_blog_post_by_slug(db, slug)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    if not post.is_published:
        if not current_user or not current_user.is_admin:
            raise HTTPException(status_code=404, detail="Blog post not found")

    crud_blog.increment_views(db, post.id)
    db.refresh(post)
    return BlogPostResponse.model_validate(post)


@router.post("/", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_blog_post(
    post: BlogPostCreate,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db),
):
    db_post = crud_blog.create_blog_post(db, post, current_user.id)
    return BlogPostResponse.model_validate(db_post)


@router.put("/{post_id}", response_model=BlogPostResponse)
def update_blog_post(
    post_id: int,
    post_update: BlogPostUpdate,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db),
):
    db_post = crud_blog.update_blog_post(db, post_id, post_update)
    if not db_post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return BlogPostResponse.model_validate(db_post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_post(
    post_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db),
):
    if not crud_blog.delete_blog_post(db, post_id):
        raise HTTPException(status_code=404, detail="Blog post not found")


@router.post("/upload-image")
async def upload_blog_image(
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_active_admin),
):
    """Upload an image for blog content or thumbnail. Returns the image URL."""
    if file.content_type not in BLOG_ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} is not allowed. Only images are accepted.",
        )

    content = await file.read()
    if len(content) > BLOG_MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum of 10MB",
        )

    file_extension = os.path.splitext(file.filename or "image.jpg")[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(BLOG_UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception:
        logger.exception("Blog image write failed for user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save image",
        )

    return {"url": f"/api/v1/blog/images/{unique_filename}", "filename": unique_filename}


