import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.blog_post import BlogPost
from app.schemas.blog_post import BlogPostCreate, BlogPostUpdate


def _generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title."""
    slug = title.lower().strip()
    slug = unicodedata.normalize("NFC", slug)
    slug = re.sub(r"[^\w\s\-\u3131-\u318e\uac00-\ud7a3]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "post"


def _ensure_unique_slug(db: Session, slug: str, exclude_id: Optional[int] = None) -> str:
    """Ensure slug is unique by appending a number if needed."""
    base_slug = slug
    counter = 1
    while True:
        query = db.query(BlogPost).filter(BlogPost.slug == slug)
        if exclude_id:
            query = query.filter(BlogPost.id != exclude_id)
        if not query.first():
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def get_blog_post(db: Session, post_id: int) -> Optional[BlogPost]:
    return db.query(BlogPost).filter(BlogPost.id == post_id).first()


def get_blog_post_by_slug(db: Session, slug: str) -> Optional[BlogPost]:
    return db.query(BlogPost).filter(BlogPost.slug == slug).first()


def get_blog_posts(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    published_only: bool = True,
) -> tuple[List[BlogPost], int]:
    query = db.query(BlogPost)

    if published_only:
        query = query.filter(BlogPost.is_published == True)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (BlogPost.title.ilike(search_filter)) | (BlogPost.summary.ilike(search_filter))
        )

    if tag:
        query = query.filter(BlogPost.tags.ilike(f"%{tag}%"))

    total = query.count()

    posts = (
        query.order_by(BlogPost.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return posts, total


def create_blog_post(db: Session, post: BlogPostCreate, user_id: int) -> BlogPost:
    slug = _ensure_unique_slug(db, _generate_slug(post.title))

    published_at = None
    if post.is_published:
        published_at = datetime.now(timezone.utc)

    db_post = BlogPost(
        title=post.title,
        slug=slug,
        content=post.content,
        summary=post.summary,
        thumbnail_url=post.thumbnail_url,
        tags=post.tags,
        is_published=post.is_published,
        published_at=published_at,
        user_id=user_id,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


def update_blog_post(db: Session, post_id: int, post_update: BlogPostUpdate) -> Optional[BlogPost]:
    db_post = get_blog_post(db, post_id)
    if not db_post:
        return None

    update_data = post_update.model_dump(exclude_unset=True)

    if "title" in update_data:
        update_data["slug"] = _ensure_unique_slug(
            db, _generate_slug(update_data["title"]), exclude_id=post_id
        )

    if "is_published" in update_data and update_data["is_published"] and not db_post.published_at:
        update_data["published_at"] = datetime.now(timezone.utc)

    for key, value in update_data.items():
        setattr(db_post, key, value)

    db.commit()
    db.refresh(db_post)
    return db_post


def delete_blog_post(db: Session, post_id: int) -> bool:
    db_post = get_blog_post(db, post_id)
    if not db_post:
        return False
    db.delete(db_post)
    db.commit()
    return True


def increment_views(db: Session, post_id: int) -> None:
    db.query(BlogPost).filter(BlogPost.id == post_id).update(
        {BlogPost.views: BlogPost.views + 1}
    )
    db.commit()
