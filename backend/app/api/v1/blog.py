from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_admin, get_current_user_optional
from app.crud import blog_post as crud_blog
from app.db.session import get_db
from app.models.user import User
from app.schemas.blog_post import (
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostListItem,
    BlogPostResponse,
    BlogPostUpdate,
)

router = APIRouter()


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
        db, page=page, page_size=page_size, published_only=False
    )
    return BlogPostListResponse(
        items=[BlogPostListItem.model_validate(p) for p in posts],
        total=total,
        page=page,
        page_size=page_size,
    )


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
