from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import case, asc, func
from app.models.deadline_post import DeadlinePost
from app.models.deadline_comment import DeadlineComment
from app.schemas.deadline_post import DeadlinePostCreate, DeadlinePostUpdate


def get_deadline_post(db: Session, post_id: int) -> Optional[DeadlinePost]:
    return db.query(DeadlinePost).filter(DeadlinePost.id == post_id).first()


def get_deadline_posts(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[DeadlinePost], int]:
    now = datetime.now(timezone.utc)

    # Active (not completed, not expired) first sorted by deadline ASC,
    # then completed/expired at the bottom
    active_sort = case(
        (
            (DeadlinePost.is_completed == False) & (DeadlinePost.deadline_at > now),
            0,
        ),
        else_=1,
    )

    total = db.query(DeadlinePost).count()
    posts = (
        db.query(DeadlinePost)
        .order_by(active_sort, asc(DeadlinePost.deadline_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return posts, total


def create_deadline_post(
    db: Session, post: DeadlinePostCreate, user_id: int
) -> DeadlinePost:
    now = datetime.now(timezone.utc)
    deadline_at = now + timedelta(hours=post.deadline_hours)

    db_post = DeadlinePost(
        title=post.title,
        content=post.content,
        user_id=user_id,
        deadline_at=deadline_at,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


def update_deadline_post(
    db: Session, post_id: int, post_update: DeadlinePostUpdate
) -> Optional[DeadlinePost]:
    db_post = get_deadline_post(db, post_id)
    if not db_post:
        return None

    update_data = post_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_post, key, value)

    db.commit()
    db.refresh(db_post)
    return db_post


def complete_deadline_post(db: Session, post_id: int) -> Optional[DeadlinePost]:
    db_post = get_deadline_post(db, post_id)
    if not db_post:
        return None

    db_post.is_completed = True
    db_post.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_post)
    return db_post


def delete_deadline_post(db: Session, post_id: int) -> bool:
    db_post = get_deadline_post(db, post_id)
    if not db_post:
        return False
    db.delete(db_post)
    db.commit()
    return True


def get_comment_count(db: Session, post_id: int) -> int:
    return (
        db.query(func.count(DeadlineComment.id))
        .filter(DeadlineComment.post_id == post_id)
        .scalar()
    )


def get_comments(db: Session, post_id: int) -> List[DeadlineComment]:
    return (
        db.query(DeadlineComment)
        .filter(DeadlineComment.post_id == post_id)
        .order_by(DeadlineComment.created_at.desc())
        .all()
    )


def get_comment(db: Session, comment_id: int) -> Optional[DeadlineComment]:
    return db.query(DeadlineComment).filter(DeadlineComment.id == comment_id).first()


def create_comment(
    db: Session, post_id: int, content: str, user_id: int
) -> DeadlineComment:
    db_comment = DeadlineComment(
        content=content,
        post_id=post_id,
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
