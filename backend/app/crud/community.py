from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case

from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.user import User


KST = timezone(timedelta(hours=9))


def get_community_stats(db: Session) -> dict:
    """KST 기준 오늘 00:00 이후 Post/Comment COUNT"""
    now_kst = datetime.now(KST)
    today_start_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_kst.astimezone(timezone.utc)

    today_posts = db.query(func.count(Post.id)).filter(
        Post.created_at >= today_start_utc
    ).scalar() or 0

    today_comments = db.query(func.count(Comment.id)).filter(
        Comment.created_at >= today_start_utc
    ).scalar() or 0

    today_signups = db.query(func.count(User.id)).filter(
        User.created_at >= today_start_utc
    ).scalar() or 0

    return {
        "today_posts": today_posts,
        "today_comments": today_comments,
        "today_signups": today_signups,
        "active_users": None,
    }


def get_pinned_posts(db: Session, limit: int = 3) -> List[Post]:
    """is_pinned=True, pinned_order ASC NULLS LAST, created_at DESC"""
    return (
        db.query(Post)
        .filter(Post.is_pinned == True)
        .order_by(
            case(
                (Post.pinned_order.is_(None), 1),
                else_=0,
            ),
            Post.pinned_order.asc(),
            Post.created_at.desc(),
        )
        .limit(limit)
        .all()
    )


def _get_window_start(window: str) -> datetime:
    """Parse window string to a UTC datetime cutoff."""
    now = datetime.now(timezone.utc)
    mapping = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = mapping.get(window, timedelta(hours=24))
    return now - delta


def get_hot_posts(
    db: Session,
    window: str = "24h",
    limit: int = 6,
    category_id: Optional[int] = None,
) -> List[dict]:
    """
    score = likes_count*3 + comment_count*2 + views*0.2
    window 기간 내 글만 대상, score DESC 정렬
    """
    window_start = _get_window_start(window)

    likes_sub = (
        db.query(
            Like.post_id,
            func.count(Like.id).label("likes_count"),
        )
        .group_by(Like.post_id)
        .subquery()
    )

    comments_sub = (
        db.query(
            Comment.post_id,
            func.count(Comment.id).label("comment_count"),
        )
        .group_by(Comment.post_id)
        .subquery()
    )

    likes_col = func.coalesce(likes_sub.c.likes_count, 0)
    comments_col = func.coalesce(comments_sub.c.comment_count, 0)
    score_expr = (
        likes_col * 3 + comments_col * 2 + Post.views * 0.2
    ).label("score")

    query = (
        db.query(
            Post,
            likes_col.label("likes_count"),
            comments_col.label("comment_count"),
            score_expr,
        )
        .outerjoin(likes_sub, Post.id == likes_sub.c.post_id)
        .outerjoin(comments_sub, Post.id == comments_sub.c.post_id)
        .filter(Post.created_at >= window_start)
    )

    if category_id:
        query = query.filter(Post.category_id == category_id)

    results = query.order_by(desc("score")).limit(limit).all()

    return [
        {
            "post": row[0],
            "likes_count": row[1],
            "comment_count": row[2],
            "score": float(row[3]) if row[3] else 0.0,
        }
        for row in results
    ]
