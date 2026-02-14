from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.category import Category
from app.schemas.post import PostCreate, PostUpdate


def get_post(db: Session, post_id: int) -> Optional[Post]:
    return db.query(Post).filter(Post.id == post_id).first()


def get_posts(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    sort: str = "latest",
) -> tuple[List[Post], int]:
    query = db.query(Post)

    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Post.title.ilike(search_filter),
                Post.content.ilike(search_filter)
            )
        )

    # Apply category filter
    if category_id:
        query = query.filter(Post.category_id == category_id)

    # Apply time window for score-based sorts
    if sort in ("hot24h", "week"):
        window_delta = timedelta(hours=24) if sort == "hot24h" else timedelta(days=7)
        window_start = datetime.now(timezone.utc) - window_delta
        query = query.filter(Post.created_at >= window_start)

    total = query.count()

    # Apply sort
    if sort == "comments":
        comments_sub = (
            db.query(
                Comment.post_id,
                func.count(Comment.id).label("cnt"),
            )
            .group_by(Comment.post_id)
            .subquery()
        )
        query = (
            query.outerjoin(comments_sub, Post.id == comments_sub.c.post_id)
            .order_by(desc(func.coalesce(comments_sub.c.cnt, 0)), desc(Post.created_at))
        )
    elif sort in ("hot24h", "week"):
        likes_sub = (
            db.query(Like.post_id, func.count(Like.id).label("lc"))
            .group_by(Like.post_id).subquery()
        )
        comments_sub = (
            db.query(Comment.post_id, func.count(Comment.id).label("cc"))
            .group_by(Comment.post_id).subquery()
        )
        score = (
            func.coalesce(likes_sub.c.lc, 0) * 3
            + func.coalesce(comments_sub.c.cc, 0) * 2
            + Post.views * 0.2
        )
        query = (
            query
            .outerjoin(likes_sub, Post.id == likes_sub.c.post_id)
            .outerjoin(comments_sub, Post.id == comments_sub.c.post_id)
            .order_by(desc(score), desc(Post.created_at))
        )
    else:
        # latest (default)
        query = query.order_by(desc(Post.created_at))

    posts = query.offset(skip).limit(limit).all()
    return posts, total


def create_post(db: Session, post: PostCreate, user_id: int) -> Post:
    db_post = Post(**post.model_dump(), user_id=user_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


def update_post(db: Session, post_id: int, post_update: PostUpdate) -> Optional[Post]:
    db_post = get_post(db, post_id)
    if not db_post:
        return None

    update_data = post_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_post, key, value)

    db.commit()
    db.refresh(db_post)
    return db_post


def delete_post(db: Session, post_id: int) -> bool:
    db_post = get_post(db, post_id)
    if not db_post:
        return False
    db.delete(db_post)
    db.commit()
    return True


def increment_views(db: Session, post_id: int) -> None:
    db_post = get_post(db, post_id)
    if db_post:
        db_post.views += 1
        db.commit()


def get_comment_count(db: Session, post_id: int) -> int:
    return db.query(func.count(Comment.id)).filter(Comment.post_id == post_id).scalar()


def get_likes_count(db: Session, post_id: int) -> int:
    return db.query(func.count(Like.id)).filter(Like.post_id == post_id).scalar()


def check_user_liked(db: Session, post_id: int, user_id: int) -> bool:
    return db.query(Like).filter(Like.post_id == post_id, Like.user_id == user_id).first() is not None
