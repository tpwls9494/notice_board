from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.bookmark import Bookmark
from app.schemas.post import PostCreate, PostUpdate


def get_post(db: Session, post_id: int) -> Optional[Post]:
    return db.query(Post).filter(Post.id == post_id).first()


def _apply_base_filters(query, search: Optional[str], category_id: Optional[int]):
    """Apply search and category filters to a query."""
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Post.title.ilike(search_filter),
                Post.content.ilike(search_filter)
            )
        )
    if category_id:
        query = query.filter(Post.category_id == category_id)
    return query


def get_posts(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    sort: str = "latest",
    window: str = "24h",
) -> tuple[List[Post], int]:
    # --- Pinned posts (page 1 only) ---
    pinned_posts: List[Post] = []
    if skip == 0:
        pinned_q = db.query(Post).filter(Post.is_pinned == True)  # noqa: E712
        pinned_q = _apply_base_filters(pinned_q, search, category_id)
        pinned_posts = pinned_q.order_by(
            func.coalesce(Post.pinned_order, 9999), desc(Post.created_at)
        ).all()

    # --- Normal (non-pinned) posts ---
    query = db.query(Post).filter(
        or_(Post.is_pinned == False, Post.is_pinned == None)  # noqa: E711,E712
    )
    query = _apply_base_filters(query, search, category_id)

    # Time window for hot sort
    window_map = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}
    if sort == "hot":
        window_delta = window_map.get(window, timedelta(hours=24))
        window_start = datetime.now(timezone.utc) - window_delta
        query = query.filter(Post.created_at >= window_start)

    normal_total = query.count()
    total = len(pinned_posts) + normal_total

    # Apply sort
    if sort == "views":
        query = query.order_by(desc(Post.views), desc(Post.created_at))
    elif sort == "likes":
        likes_sub = (
            db.query(Like.post_id, func.count(Like.id).label("lc"))
            .group_by(Like.post_id).subquery()
        )
        query = (
            query.outerjoin(likes_sub, Post.id == likes_sub.c.post_id)
            .order_by(desc(func.coalesce(likes_sub.c.lc, 0)), desc(Post.created_at))
        )
    elif sort == "comments":
        comments_sub = (
            db.query(Comment.post_id, func.count(Comment.id).label("cnt"))
            .group_by(Comment.post_id).subquery()
        )
        query = (
            query.outerjoin(comments_sub, Post.id == comments_sub.c.post_id)
            .order_by(desc(func.coalesce(comments_sub.c.cnt, 0)), desc(Post.created_at))
        )
    elif sort == "hot":
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

    normal_posts = query.offset(skip).limit(limit).all()
    posts = pinned_posts + normal_posts
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


def get_post_engagement_maps(
    db: Session,
    post_ids: Iterable[int],
    user_id: Optional[int] = None,
) -> tuple[dict[int, int], dict[int, int], Set[int], Set[int]]:
    """
    Fetch engagement metrics in bulk to avoid per-post N+1 queries.
    Returns:
      - comment_count_by_post_id
      - likes_count_by_post_id
      - liked_post_ids_for_user
      - bookmarked_post_ids_for_user
    """
    normalized_ids = [int(post_id) for post_id in post_ids if post_id is not None]
    if not normalized_ids:
        return {}, {}, set(), set()

    comment_rows = (
        db.query(Comment.post_id, func.count(Comment.id))
        .filter(Comment.post_id.in_(normalized_ids))
        .group_by(Comment.post_id)
        .all()
    )
    comment_count_by_post_id = {post_id: count for post_id, count in comment_rows}

    like_rows = (
        db.query(Like.post_id, func.count(Like.id))
        .filter(Like.post_id.in_(normalized_ids))
        .group_by(Like.post_id)
        .all()
    )
    likes_count_by_post_id = {post_id: count for post_id, count in like_rows}

    liked_post_ids_for_user: Set[int] = set()
    bookmarked_post_ids_for_user: Set[int] = set()

    if user_id is not None:
        liked_rows = (
            db.query(Like.post_id)
            .filter(Like.user_id == user_id, Like.post_id.in_(normalized_ids))
            .all()
        )
        liked_post_ids_for_user = {post_id for (post_id,) in liked_rows}

        bookmarked_rows = (
            db.query(Bookmark.post_id)
            .filter(Bookmark.user_id == user_id, Bookmark.post_id.in_(normalized_ids))
            .all()
        )
        bookmarked_post_ids_for_user = {post_id for (post_id,) in bookmarked_rows}

    return (
        comment_count_by_post_id,
        likes_count_by_post_id,
        liked_post_ids_for_user,
        bookmarked_post_ids_for_user,
    )


def get_comment_count(db: Session, post_id: int) -> int:
    return db.query(func.count(Comment.id)).filter(Comment.post_id == post_id).scalar()


def get_likes_count(db: Session, post_id: int) -> int:
    return db.query(func.count(Like.id)).filter(Like.post_id == post_id).scalar()


def check_user_liked(db: Session, post_id: int, user_id: int) -> bool:
    return db.query(Like).filter(Like.post_id == post_id, Like.user_id == user_id).first() is not None


def check_user_bookmarked(db: Session, post_id: int, user_id: int) -> bool:
    return (
        db.query(Bookmark)
        .filter(Bookmark.post_id == post_id, Bookmark.user_id == user_id)
        .first()
        is not None
    )
