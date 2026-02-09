from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.comment import Comment
from app.schemas.comment import CommentCreate


def get_comment(db: Session, comment_id: int) -> Optional[Comment]:
    return db.query(Comment).filter(Comment.id == comment_id).first()


def get_comments_by_post(db: Session, post_id: int) -> List[Comment]:
    return (
        db.query(Comment)
        .filter(Comment.post_id == post_id)
        .order_by(desc(Comment.created_at))
        .all()
    )


def create_comment(db: Session, comment: CommentCreate, user_id: int) -> Comment:
    db_comment = Comment(
        content=comment.content,
        post_id=comment.post_id,
        user_id=user_id,
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


def delete_comment(db: Session, comment_id: int) -> bool:
    db_comment = get_comment(db, comment_id)
    if not db_comment:
        return False
    db.delete(db_comment)
    db.commit()
    return True
