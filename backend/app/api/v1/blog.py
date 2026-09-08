import logging
import os
import uuid
import re
from io import BytesIO
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from PIL import Image, UnidentifiedImageError

from app.api.deps import get_current_blog_author, get_current_user_optional
from app.crud import blog_post as crud_blog
from app.crud import blog_category as crud_blog_cat
from app.db.session import get_db
from app.models.user import User
from app.models.blog_post import BlogPost, BlogProfile
from app.schemas.blog_post import (
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostListItem,
    BlogPostResponse,
    BlogPostUpdate,
    BlogPostAdminListResponse,
    BlogPostCounts,
)
from app.schemas.blog_category import BlogCategoryCreate, BlogCategoryResponse
from app.api.v1.blog_activity import router as activity_router
from app.services.blog_html import metadata, render_blog_html
from app.core.config import settings

router = APIRouter()
router.include_router(activity_router)
logger = logging.getLogger(__name__)

BLOG_UPLOAD_DIR = "/app/uploads/blog"
os.makedirs(BLOG_UPLOAD_DIR, exist_ok=True)

BLOG_MAX_FILE_SIZE = 10 * 1024 * 1024
BLOG_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
AVATAR_MAX_SIZE = 5 * 1024 * 1024
AVATAR_FORMATS = {"PNG": ("image/png", ".png"), "JPEG": ("image/jpeg", ".jpg"), "WEBP": ("image/webp", ".webp"), "GIF": ("image/gif", ".gif")}


@router.get("/render/{path:path}", include_in_schema=False)
def render_public_blog(path: str, request: Request, db: Session = Depends(get_db)):
    path = path.strip("/")
    private = path.split("/")[0] in {"login", "write", "edit", "drafts", "admin", "oauth"}
    post = None
    code = 200
    if path and not private:
        post = db.query(BlogPost).filter(BlogPost.slug == path, BlogPost.is_published.is_(True)).first()
        if not post:
            private, code = True, 404
    data = metadata(post, private=private or bool(request.query_params))
    try:
        body = render_blog_html(data)
    except (OSError, ValueError):
        return Response("Blog frontend is preparing. Please retry shortly.", status_code=503, headers={"Retry-After": "30"})
    return Response(body, status_code=code, media_type="text/html", headers={"Cache-Control": "no-store", "X-Robots-Tag": data["robots"]})


@router.get("/og/default.png", include_in_schema=False)
def blog_default_og():
    from app.services.og_image import generate_blog_og
    return Response(generate_blog_og(), media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/robots.txt", include_in_schema=False)
def blog_robots():
    body = "User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/v1/blog/images/\nAllow: /api/v1/blog/og/\nSitemap: " + settings.BLOG_PUBLIC_ORIGIN.rstrip("/") + "/sitemap.xml\n"
    return Response(body, media_type="text/plain")


def _remove_avatar(url: str | None):
    if not url or not url.startswith("/api/v1/blog/images/"):
        return
    filename = url.removeprefix("/api/v1/blog/images/")
    if not re.fullmatch(r"avatar-[0-9a-f]{32}\.(png|jpg|webp|gif)", filename):
        return
    try:
        os.remove(os.path.join(BLOG_UPLOAD_DIR, filename))
    except FileNotFoundError:
        pass
    except OSError:
        logger.warning("Could not remove unused blog avatar %s", filename)


@router.get("/profile")
def get_blog_profile(response: Response, db: Session = Depends(get_db)):
    profile = db.get(BlogProfile, 1)
    response.headers["Cache-Control"] = "no-store"
    return {"image_url": profile.image_url if profile else None}


@router.post("/profile/avatar")
async def update_blog_avatar(file: UploadFile = FastAPIFile(...), db: Session = Depends(get_db), user: User = Depends(get_current_blog_author)):
    if file.content_type not in BLOG_ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "JPG, PNG, GIF, WebP 이미지를 선택해 주세요.")
    content = await file.read(AVATAR_MAX_SIZE + 1)
    if len(content) > AVATAR_MAX_SIZE:
        raise HTTPException(400, "프로필 이미지는 5MB 이하로 올려주세요.")
    try:
        with Image.open(BytesIO(content)) as avatar:
            format_info = AVATAR_FORMATS.get(avatar.format)
            if not format_info or format_info[0] != file.content_type or avatar.width * avatar.height > 25_000_000:
                raise ValueError("Unsupported image")
            avatar.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(400, "이미지를 읽을 수 없습니다. 다른 이미지로 시도해 주세요.")

    image_url = f"/api/v1/blog/images/avatar-{uuid.uuid4().hex}{format_info[1]}"
    filepath = os.path.join(BLOG_UPLOAD_DIR, image_url.rsplit("/", 1)[-1])
    profile = db.get(BlogProfile, 1)
    old_url = profile.image_url if profile else None
    try:
        with open(filepath, "wb") as target:
            target.write(content)
        if profile is None:
            profile = BlogProfile(id=1)
            db.add(profile)
        profile.image_url = image_url
        db.commit()
    except Exception:
        db.rollback()
        _remove_avatar(image_url)
        logger.exception("Blog avatar save failed for user_id=%s", user.id)
        raise HTTPException(500, "프로필 이미지를 저장하지 못했습니다. 다시 시도해 주세요.")
    _remove_avatar(old_url)
    return {"image_url": image_url}


@router.delete("/profile/avatar")
def reset_blog_avatar(db: Session = Depends(get_db), user: User = Depends(get_current_blog_author)):
    profile = db.get(BlogProfile, 1)
    if profile:
        old_url = profile.image_url
        profile.image_url = None
        db.commit()
        _remove_avatar(old_url)
    return {"image_url": None}


@router.get("/categories", response_model=list[BlogCategoryResponse])
def get_blog_categories(db: Session = Depends(get_db)):
    categories = crud_blog_cat.get_blog_categories(db)
    return [BlogCategoryResponse.model_validate(c) for c in categories]


@router.post("/categories", response_model=BlogCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_blog_category(
    body: BlogCategoryCreate,
    current_user: User = Depends(get_current_blog_author),
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
    current_user: User = Depends(get_current_blog_author),
    db: Session = Depends(get_db),
):
    if not crud_blog_cat.delete_blog_category(db, category_id):
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")


@router.get("/manage/posts", response_model=BlogPostAdminListResponse)
def manage_blog_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status: Literal["all", "published", "draft"] = "all",
    search: Optional[str] = Query(None, max_length=255),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_blog_author),
):
    posts, total = crud_blog.get_blog_posts(
        db, page=page, page_size=page_size, search=search,
        published_only=status == "published", drafts_only=status == "draft", sort_by_updated=True,
    )
    count, published = db.query(func.count(BlogPost.id), func.sum(case((BlogPost.is_published.is_(True), 1), else_=0))).one()
    return BlogPostAdminListResponse(
        items=[BlogPostListItem.model_validate(post) for post in posts], total=total, page=page, page_size=page_size,
        counts=BlogPostCounts(total=count, published=published or 0, draft=count - (published or 0)),
    )


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
    current_user: User = Depends(get_current_blog_author),
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
        if not current_user or not current_user.can_write_blog:
            raise HTTPException(status_code=404, detail="Blog post not found")

    crud_blog.increment_views(db, post.id)
    db.refresh(post)
    return BlogPostResponse.model_validate(post)


@router.post("/", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_blog_post(
    post: BlogPostCreate,
    current_user: User = Depends(get_current_blog_author),
    db: Session = Depends(get_db),
):
    db_post = crud_blog.create_blog_post(db, post, current_user.id)
    return BlogPostResponse.model_validate(db_post)


@router.put("/{post_id}", response_model=BlogPostResponse)
def update_blog_post(
    post_id: int,
    post_update: BlogPostUpdate,
    current_user: User = Depends(get_current_blog_author),
    db: Session = Depends(get_db),
):
    db_post = crud_blog.update_blog_post(db, post_id, post_update)
    if not db_post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return BlogPostResponse.model_validate(db_post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_post(
    post_id: int,
    current_user: User = Depends(get_current_blog_author),
    db: Session = Depends(get_db),
):
    if not crud_blog.delete_blog_post(db, post_id):
        raise HTTPException(status_code=404, detail="Blog post not found")


@router.post("/upload-image")
async def upload_blog_image(
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_blog_author),
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


