from sqlalchemy.orm import Session
from app.models.bookmark import Bookmark
from app.models.post import Post
from sqlalchemy.orm import joinedload


def create_bookmark(db: Session, post_id: int, user_id: int):
    """Create a bookmark for a post by a user"""
    db_bookmark = Bookmark(post_id=post_id, user_id=user_id)
    db.add(db_bookmark)
    db.commit()
    db.refresh(db_bookmark)
    return db_bookmark


def delete_bookmark(db: Session, post_id: int, user_id: int):
    """Delete a bookmark (remove bookmark from a post)"""
    db_bookmark = db.query(Bookmark).filter(
        Bookmark.post_id == post_id,
        Bookmark.user_id == user_id
    ).first()

    if db_bookmark:
        db.delete(db_bookmark)
        db.commit()
        return True
    return False


def get_bookmark(db: Session, post_id: int, user_id: int):
    """Check if a user has bookmarked a post"""
    return db.query(Bookmark).filter(
        Bookmark.post_id == post_id,
        Bookmark.user_id == user_id
    ).first()


def get_user_bookmarks(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Get all bookmarks by a user with post details"""
    return db.query(Bookmark).filter(
        Bookmark.user_id == user_id
    ).options(
        joinedload(Bookmark.post).joinedload(Post.author),
        joinedload(Bookmark.post).joinedload(Post.category)
    ).order_by(
        Bookmark.created_at.desc()
    ).offset(skip).limit(limit).all()


def get_user_bookmarks_count(db: Session, user_id: int):
    """Get the number of bookmarks by a user"""
    return db.query(Bookmark).filter(Bookmark.user_id == user_id).count()
