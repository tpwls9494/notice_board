from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud import bookmark as crud_bookmark
from app.crud import post as crud_post
from app.db.session import get_db
from app.models.user import User
from app.schemas.bookmark import (
    BookmarkListItem,
    BookmarkListResponse,
    BookmarkPostSummary,
    BookmarkResponse,
    BookmarkStatusResponse,
)

router = APIRouter()


@router.get("/me", response_model=BookmarkListResponse)
def get_my_bookmarks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    bookmarks = crud_bookmark.get_user_bookmarks(
        db, user_id=current_user.id, skip=skip, limit=page_size
    )
    total = crud_bookmark.get_user_bookmarks_count(db, current_user.id)

    bookmark_items: list[BookmarkListItem] = []
    for bookmark in bookmarks:
        post = bookmark.post
        if post is None:
            continue
        bookmark_items.append(
            BookmarkListItem(
                id=bookmark.id,
                post_id=bookmark.post_id,
                user_id=bookmark.user_id,
                created_at=bookmark.created_at,
                post=BookmarkPostSummary(
                    id=post.id,
                    title=post.title,
                    category_name=post.category.name if post.category else None,
                    author_username=post.author.username if post.author else None,
                    created_at=post.created_at,
                    views=post.views,
                    likes_count=crud_post.get_likes_count(db, post.id),
                    comment_count=crud_post.get_comment_count(db, post.id),
                ),
            )
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "bookmarks": bookmark_items,
    }


@router.get("/posts/{post_id}/status", response_model=BookmarkStatusResponse)
def get_bookmark_status(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    is_bookmarked = crud_bookmark.get_bookmark(db, post_id, current_user.id) is not None
    return {"post_id": post_id, "is_bookmarked": is_bookmarked}


@router.post("/posts/{post_id}", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
def create_bookmark(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    existing_bookmark = crud_bookmark.get_bookmark(db, post_id, current_user.id)
    if existing_bookmark:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post already bookmarked",
        )

    try:
        bookmark = crud_bookmark.create_bookmark(db, post_id, current_user.id)
        return bookmark
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post already bookmarked",
        )


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    success = crud_bookmark.delete_bookmark(db, post_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark not found",
        )

    return None
