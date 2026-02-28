import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.notification import NotificationCreate
from app.models.user import User
from app.crud import comment as crud_comment
from app.crud import notification as crud_notification
from app.crud import post as crud_post

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/post/{post_id}", response_model=List[CommentResponse])
def get_comments(post_id: int, db: Session = Depends(get_db)):
    # Check if post exists
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )

    comments = crud_comment.get_comments_by_post(db, post_id)
    return [
        CommentResponse(
            id=comment.id,
            content=comment.content,
            post_id=comment.post_id,
            user_id=comment.user_id,
            created_at=comment.created_at,
            author_username=comment.author.username if comment.author else None,
            author_profile_image_url=comment.author.profile_image_url if comment.author else None,
        )
        for comment in comments
    ]


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    comment: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check if post exists
    post = crud_post.get_post(db, comment.post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )

    db_comment = crud_comment.create_comment(db, comment, current_user.id)

    if post.user_id != current_user.id:
        try:
            crud_notification.create_notification(
                db,
                NotificationCreate(
                    user_id=post.user_id,
                    type="comment",
                    content=f"{current_user.username}님이 회원님의 게시글에 댓글을 남겼습니다.",
                    related_post_id=post.id,
                    related_comment_id=db_comment.id,
                ),
            )
        except Exception as exc:
            logger.warning("Failed to create comment notification: %s", exc)

    return CommentResponse(
        id=db_comment.id,
        content=db_comment.content,
        post_id=db_comment.post_id,
        user_id=db_comment.user_id,
        created_at=db_comment.created_at,
        author_username=current_user.username,
        author_profile_image_url=current_user.profile_image_url,
    )


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_comment = crud_comment.get_comment(db, comment_id)
    if not db_comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="댓글을 찾을 수 없습니다.",
        )

    # Check if user is the author or admin
    if db_comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다.",
        )

    crud_comment.delete_comment(db, comment_id)
    return None
