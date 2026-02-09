from sqlalchemy.orm import Session
from app.models.like import Like


def create_like(db: Session, post_id: int, user_id: int):
    """Create a like for a post by a user"""
    db_like = Like(post_id=post_id, user_id=user_id)
    db.add(db_like)
    db.commit()
    db.refresh(db_like)
    return db_like


def delete_like(db: Session, post_id: int, user_id: int):
    """Delete a like (unlike a post)"""
    db_like = db.query(Like).filter(
        Like.post_id == post_id,
        Like.user_id == user_id
    ).first()

    if db_like:
        db.delete(db_like)
        db.commit()
        return True
    return False


def get_like(db: Session, post_id: int, user_id: int):
    """Check if a user has liked a post"""
    return db.query(Like).filter(
        Like.post_id == post_id,
        Like.user_id == user_id
    ).first()


def get_post_likes_count(db: Session, post_id: int):
    """Get the number of likes for a post"""
    return db.query(Like).filter(Like.post_id == post_id).count()


def get_user_likes(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Get all posts liked by a user"""
    return db.query(Like).filter(Like.user_id == user_id).offset(skip).limit(limit).all()
