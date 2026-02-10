from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.deadline_post import (
    DeadlinePostCreate, DeadlinePostUpdate, DeadlinePostResponse,
    DeadlinePostListResponse, DeadlineCommentCreate, DeadlineCommentResponse,
)
from app.models.user import User
from app.crud import deadline_post as crud_deadline

router = APIRouter()


def _build_response(post, db) -> DeadlinePostResponse:
    now = datetime.now(timezone.utc)
    deadline_at = post.deadline_at
    if deadline_at.tzinfo is None:
        deadline_at = deadline_at.replace(tzinfo=timezone.utc)
    remaining = (deadline_at - now).total_seconds()
    is_expired = remaining <= 0
    is_urgent = not is_expired and remaining < 1800  # < 30 min

    return DeadlinePostResponse(
        id=post.id,
        title=post.title,
        content=post.content,
        user_id=post.user_id,
        deadline_at=post.deadline_at,
        is_completed=post.is_completed,
        completed_at=post.completed_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author_username=post.author.username if post.author else None,
        remaining_seconds=max(0, remaining),
        is_expired=is_expired,
        is_urgent=is_urgent,
        comment_count=crud_deadline.get_comment_count(db, post.id),
    )


@router.get("/", response_model=DeadlinePostListResponse)
def get_deadline_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    posts, total = crud_deadline.get_deadline_posts(db)
    post_responses = [_build_response(p, db) for p in posts]
    return {"total": total, "posts": post_responses}


@router.get("/{post_id}", response_model=DeadlinePostResponse)
def get_deadline_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = crud_deadline.get_deadline_post(db, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _build_response(post, db)


@router.post("/", response_model=DeadlinePostResponse, status_code=status.HTTP_201_CREATED)
def create_deadline_post(
    post: DeadlinePostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_deadline.create_deadline_post(db, post, current_user.id)
    return _build_response(db_post, db)


@router.put("/{post_id}", response_model=DeadlinePostResponse)
def update_deadline_post(
    post_id: int,
    post_update: DeadlinePostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_deadline.get_deadline_post(db, post_id)
    if not db_post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if db_post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    updated = crud_deadline.update_deadline_post(db, post_id, post_update)
    return _build_response(updated, db)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deadline_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_deadline.get_deadline_post(db, post_id)
    if not db_post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if db_post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    crud_deadline.delete_deadline_post(db, post_id)
    return None


@router.post("/{post_id}/complete", response_model=DeadlinePostResponse)
def complete_deadline_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_deadline.get_deadline_post(db, post_id)
    if not db_post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if db_post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="작성자만 완료 처리할 수 있습니다")
    if db_post.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 완료된 게시글입니다")

    completed = crud_deadline.complete_deadline_post(db, post_id)
    return _build_response(completed, db)


# --- Comments ---

@router.get("/{post_id}/comments", response_model=list[DeadlineCommentResponse])
def get_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = crud_deadline.get_deadline_post(db, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    comments = crud_deadline.get_comments(db, post_id)
    return [
        DeadlineCommentResponse(
            id=c.id,
            content=c.content,
            post_id=c.post_id,
            user_id=c.user_id,
            created_at=c.created_at,
            author_username=c.author.username if c.author else None,
        )
        for c in comments
    ]


@router.post("/{post_id}/comments", response_model=DeadlineCommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    comment: DeadlineCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = crud_deadline.get_deadline_post(db, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    db_comment = crud_deadline.create_comment(db, post_id, comment.content, current_user.id)
    return DeadlineCommentResponse(
        id=db_comment.id,
        content=db_comment.content,
        post_id=db_comment.post_id,
        user_id=db_comment.user_id,
        created_at=db_comment.created_at,
        author_username=current_user.username,
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = crud_deadline.get_comment(db, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    crud_deadline.delete_comment(db, comment_id)
    return None
