from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.schemas.post import PostCreate, PostUpdate, PostResponse, PostListResponse
from app.models.user import User
from app.models.category import Category
from app.crud import post as crud_post

router = APIRouter()
NOTICE_CATEGORY_SLUG = "notice"


def get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


def ensure_notice_write_permission(category: Category, current_user: User) -> None:
    if category.slug == NOTICE_CATEGORY_SLUG and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can write notice posts",
        )


@router.get("/", response_model=PostListResponse)
def get_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    sort: Optional[str] = Query("latest"),
    window: Optional[str] = Query("24h"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    skip = (page - 1) * page_size
    posts, total = crud_post.get_posts(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        category_id=category_id,
        sort=sort or "latest",
        window=window or "24h",
    )

    # Add author username, comment count, likes count, and is_liked
    post_responses = []
    for post in posts:
        post_dict = {
            "id": post.id,
            "title": post.title,
            "content": post.content,
            "views": post.views,
            "user_id": post.user_id,
            "category_id": post.category_id,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "author_username": post.author.username if post.author else None,
            "comment_count": crud_post.get_comment_count(db, post.id),
            "likes_count": crud_post.get_likes_count(db, post.id),
            "is_liked": crud_post.check_user_liked(db, post.id, current_user.id) if current_user else False,
            "is_pinned": post.is_pinned or False,
            "category_name": post.category.name if post.category else None,
        }
        post_responses.append(PostResponse(**post_dict))

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "posts": post_responses,
    }


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Increment views
    crud_post.increment_views(db, post_id)

    return PostResponse(
        id=post.id,
        title=post.title,
        content=post.content,
        views=post.views + 1,
        user_id=post.user_id,
        category_id=post.category_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author_username=post.author.username if post.author else None,
        comment_count=crud_post.get_comment_count(db, post.id),
        likes_count=crud_post.get_likes_count(db, post.id),
        is_liked=crud_post.check_user_liked(db, post.id, current_user.id) if current_user else False,
        is_pinned=post.is_pinned or False,
        category_name=post.category.name if post.category else None,
    )


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = get_category_or_404(db, post.category_id)
    ensure_notice_write_permission(category, current_user)

    db_post = crud_post.create_post(db, post, current_user.id)
    return PostResponse(
        id=db_post.id,
        title=db_post.title,
        content=db_post.content,
        views=db_post.views,
        user_id=db_post.user_id,
        category_id=db_post.category_id,
        created_at=db_post.created_at,
        updated_at=db_post.updated_at,
        author_username=current_user.username,
        comment_count=0,
        likes_count=0,
        is_liked=False,
        is_pinned=db_post.is_pinned or False,
        category_name=db_post.category.name if db_post.category else None,
    )


@router.put("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    post_update: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_post.get_post(db, post_id)
    if not db_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Check if user is the author or admin
    if db_post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    target_category_id = (
        post_update.category_id if post_update.category_id is not None else db_post.category_id
    )
    target_category = get_category_or_404(db, target_category_id)
    ensure_notice_write_permission(target_category, current_user)

    updated_post = crud_post.update_post(db, post_id, post_update)
    return PostResponse(
        id=updated_post.id,
        title=updated_post.title,
        content=updated_post.content,
        views=updated_post.views,
        user_id=updated_post.user_id,
        category_id=updated_post.category_id,
        created_at=updated_post.created_at,
        updated_at=updated_post.updated_at,
        author_username=updated_post.author.username if updated_post.author else None,
        comment_count=crud_post.get_comment_count(db, post_id),
        likes_count=crud_post.get_likes_count(db, post_id),
        is_liked=crud_post.check_user_liked(db, post_id, current_user.id),
        is_pinned=updated_post.is_pinned or False,
        category_name=updated_post.category.name if updated_post.category else None,
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_post.get_post(db, post_id)
    if not db_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Check if user is the author or admin
    if db_post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    crud_post.delete_post(db, post_id)
    return None
