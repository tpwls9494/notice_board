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
    category_id: Optional[int] = None
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

    total = query.count()
    posts = query.order_by(desc(Post.created_at)).offset(skip).limit(limit).all()
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
