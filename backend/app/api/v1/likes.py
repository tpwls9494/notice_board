import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.schemas.like import LikeResponse
from app.schemas.notification import NotificationCreate
from app.crud import like as crud_like
from app.crud import notification as crud_notification
from app.crud import post as crud_post
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/posts/{post_id}/like", response_model=LikeResponse)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Like a post"""
    # Check if post exists
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )

    # Check if already liked
    existing_like = crud_like.get_like(db, post_id, current_user.id)
    if existing_like:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post already liked"
        )

    try:
        like = crud_like.create_like(db, post_id, current_user.id)
        if post.user_id != current_user.id:
            try:
                crud_notification.create_notification(
                    db,
                    NotificationCreate(
                        user_id=post.user_id,
                        type="like",
                        content=f"{current_user.username} liked your post.",
                        related_post_id=post.id,
                    ),
                )
            except Exception as exc:
                logger.warning("Failed to create like notification: %s", exc)
        return like
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post already liked"
        )


@router.delete("/posts/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unlike a post"""
    # Check if post exists
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )

    success = crud_like.delete_like(db, post_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Like not found"
        )


@router.get("/posts/{post_id}/likes/count")
def get_post_likes_count(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Get the number of likes for a post"""
    count = crud_like.get_post_likes_count(db, post_id)
    return {"post_id": post_id, "likes_count": count}
