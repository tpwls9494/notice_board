from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.comment import CommentCreate, CommentResponse
from app.models.user import User
from app.crud import comment as crud_comment
from app.crud import post as crud_post

router = APIRouter()


@router.get("/post/{post_id}", response_model=List[CommentResponse])
def get_comments(post_id: int, db: Session = Depends(get_db)):
    # Check if post exists
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
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
            detail="Post not found",
        )

    db_comment = crud_comment.create_comment(db, comment, current_user.id)
    return CommentResponse(
        id=db_comment.id,
        content=db_comment.content,
        post_id=db_comment.post_id,
        user_id=db_comment.user_id,
        created_at=db_comment.created_at,
        author_username=current_user.username,
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
            detail="Comment not found",
        )

    # Check if user is the author or admin
    if db_comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    crud_comment.delete_comment(db, comment_id)
    return None
