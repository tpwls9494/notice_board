from typing import List, Tuple

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_follow import UserFollow


def get_follow(db: Session, follower_id: int, following_id: int) -> UserFollow | None:
    return (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == follower_id,
            UserFollow.following_id == following_id,
        )
        .first()
    )


def create_follow(db: Session, follower_id: int, following_id: int) -> UserFollow:
    db_follow = UserFollow(follower_id=follower_id, following_id=following_id)
    db.add(db_follow)
    db.commit()
    db.refresh(db_follow)
    return db_follow


def delete_follow(db: Session, follower_id: int, following_id: int) -> bool:
    db_follow = get_follow(db, follower_id=follower_id, following_id=following_id)
    if not db_follow:
        return False

    db.delete(db_follow)
    db.commit()
    return True


def is_following(db: Session, follower_id: int, following_id: int) -> bool:
    return get_follow(db, follower_id=follower_id, following_id=following_id) is not None


def get_following_user_ids(db: Session, follower_id: int) -> List[int]:
    rows = (
        db.query(UserFollow.following_id)
        .filter(UserFollow.follower_id == follower_id)
        .all()
    )
    return [following_id for (following_id,) in rows]


def get_followers(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[list[tuple[User, UserFollow]], int]:
    query = (
        db.query(User, UserFollow)
        .join(UserFollow, UserFollow.follower_id == User.id)
        .filter(UserFollow.following_id == user_id)
    )
    total = query.count()
    rows = (
        query
        .order_by(desc(UserFollow.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return rows, total


def get_followings(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[list[tuple[User, UserFollow]], int]:
    query = (
        db.query(User, UserFollow)
        .join(UserFollow, UserFollow.following_id == User.id)
        .filter(UserFollow.follower_id == user_id)
    )
    total = query.count()
    rows = (
        query
        .order_by(desc(UserFollow.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return rows, total
