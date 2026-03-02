from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional, Sequence, Set

from sqlalchemy import asc, case, desc, false, func, or_
from sqlalchemy.orm import Session

from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.like import Like
from app.models.post import Post
from app.models.recruit_meta import RecruitMeta
from app.schemas.post import POST_TYPE_NORMAL, POST_TYPE_RECRUIT, PostCreate, PostUpdate


def get_post(db: Session, post_id: int) -> Optional[Post]:
    return db.query(Post).filter(Post.id == post_id).first()


def _normalize_post_type(post_type: Optional[str]) -> Optional[str]:
    if not post_type:
        return None
    normalized = post_type.strip().upper()
    if normalized in {POST_TYPE_NORMAL, POST_TYPE_RECRUIT}:
        return normalized
    return None


def _normalize_recruit_status(status: Optional[str]) -> Optional[str]:
    if not status:
        return None
    normalized = status.strip().upper()
    if normalized in {"OPEN", "CLOSED"}:
        return normalized
    return None


def _apply_base_filters(
    query,
    search: Optional[str],
    category_id: Optional[int],
    post_type: Optional[str],
    author_ids: Optional[Sequence[int]] = None,
):
    """Apply search/category/post-type filters to a query."""
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Post.title.ilike(search_filter),
                Post.content.ilike(search_filter),
            )
        )
    if category_id:
        query = query.filter(Post.category_id == category_id)
    if post_type:
        query = query.filter(Post.post_type == post_type)
    if author_ids is not None:
        normalized_author_ids = [int(author_id) for author_id in author_ids if author_id is not None]
        if normalized_author_ids:
            query = query.filter(Post.user_id.in_(normalized_author_ids))
        else:
            query = query.filter(false())
    return query


def _apply_recruit_filters(
    query,
    recruit_type: Optional[str],
    recruit_status: Optional[str],
    recruit_is_online: Optional[bool],
    ensure_join: bool = False,
):
    normalized_recruit_type = recruit_type.strip().upper() if recruit_type else None
    normalized_recruit_status = _normalize_recruit_status(recruit_status)

    needs_join = ensure_join or bool(
        normalized_recruit_type
        or normalized_recruit_status
        or recruit_is_online is not None
    )
    if needs_join:
        query = query.join(RecruitMeta, RecruitMeta.post_id == Post.id)
        if normalized_recruit_type:
            query = query.filter(RecruitMeta.recruit_type == normalized_recruit_type)
        if normalized_recruit_status:
            query = query.filter(RecruitMeta.status == normalized_recruit_status)
        if recruit_is_online is not None:
            query = query.filter(RecruitMeta.is_online == recruit_is_online)

    return query


def get_posts(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    sort: str = "latest",
    window: str = "24h",
    post_type: Optional[str] = None,
    recruit_type: Optional[str] = None,
    recruit_status: Optional[str] = None,
    recruit_is_online: Optional[bool] = None,
    author_ids: Optional[Sequence[int]] = None,
) -> tuple[List[Post], int]:
    normalized_post_type = _normalize_post_type(post_type)
    normalized_sort = (sort or "latest").lower()

    # deadline sorting is meaningful only for recruit posts
    if normalized_sort == "deadline" and not normalized_post_type:
        normalized_post_type = POST_TYPE_RECRUIT

    is_recruit_listing = bool(
        normalized_post_type == POST_TYPE_RECRUIT
        or recruit_type
        or recruit_status
        or recruit_is_online is not None
        or normalized_sort == "deadline"
    )

    # --- Pinned posts (page 1 only, normal board only) ---
    pinned_posts: List[Post] = []
    if skip == 0 and not is_recruit_listing:
        pinned_q = db.query(Post).filter(Post.is_pinned == True)  # noqa: E712
        pinned_q = _apply_base_filters(
            pinned_q,
            search,
            category_id,
            normalized_post_type,
            author_ids=author_ids,
        )
        pinned_posts = pinned_q.order_by(
            func.coalesce(Post.pinned_order, 9999),
            desc(Post.created_at),
        ).all()

    # --- Normal (non-pinned) posts ---
    query = db.query(Post).filter(
        or_(Post.is_pinned == False, Post.is_pinned == None)  # noqa: E711,E712
    )
    query = _apply_base_filters(
        query,
        search,
        category_id,
        normalized_post_type,
        author_ids=author_ids,
    )
    query = _apply_recruit_filters(
        query,
        recruit_type=recruit_type,
        recruit_status=recruit_status,
        recruit_is_online=recruit_is_online,
        ensure_join=is_recruit_listing,
    )

    # Time window for hot sort
    window_map = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    if normalized_sort == "hot":
        window_delta = window_map.get(window, timedelta(hours=24))
        window_start = datetime.now(timezone.utc) - window_delta
        query = query.filter(Post.created_at >= window_start)

    normal_total = query.count()
    total = len(pinned_posts) + normal_total

    # Apply sort
    if normalized_sort == "views":
        query = query.order_by(desc(Post.views), desc(Post.created_at))
    elif normalized_sort == "likes":
        likes_sub = (
            db.query(Like.post_id, func.count(Like.id).label("lc"))
            .group_by(Like.post_id)
            .subquery()
        )
        query = (
            query.outerjoin(likes_sub, Post.id == likes_sub.c.post_id)
            .order_by(desc(func.coalesce(likes_sub.c.lc, 0)), desc(Post.created_at))
        )
    elif normalized_sort == "comments":
        comments_sub = (
            db.query(Comment.post_id, func.count(Comment.id).label("cnt"))
            .group_by(Comment.post_id)
            .subquery()
        )
        query = (
            query.outerjoin(comments_sub, Post.id == comments_sub.c.post_id)
            .order_by(desc(func.coalesce(comments_sub.c.cnt, 0)), desc(Post.created_at))
        )
    elif normalized_sort == "hot":
        likes_sub = (
            db.query(Like.post_id, func.count(Like.id).label("lc"))
            .group_by(Like.post_id)
            .subquery()
        )
        comments_sub = (
            db.query(Comment.post_id, func.count(Comment.id).label("cc"))
            .group_by(Comment.post_id)
            .subquery()
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
    elif normalized_sort == "deadline":
        query = query.order_by(
            case((RecruitMeta.deadline_at.is_(None), 1), else_=0),
            asc(RecruitMeta.deadline_at),
            desc(Post.created_at),
        )
    else:
        # latest (default)
        query = query.order_by(desc(Post.created_at))

    normal_posts = query.offset(skip).limit(limit).all()
    posts = pinned_posts + normal_posts
    return posts, total


def create_post(db: Session, post: PostCreate, user_id: int) -> Post:
    post_data = post.model_dump(exclude={"recruit_meta"})
    recruit_meta_data = (
        post.recruit_meta.model_dump()
        if post.recruit_meta is not None
        else None
    )

    db_post = Post(**post_data, user_id=user_id)
    db.add(db_post)
    db.flush()

    if db_post.post_type == POST_TYPE_RECRUIT:
        if recruit_meta_data is None:
            raise ValueError("모집 글에는 모집 정보를 입력해야 합니다.")
        # Recruit posts always start as OPEN. Closing is handled later via edit.
        recruit_meta_data["status"] = "OPEN"
        if recruit_meta_data.get("is_online"):
            recruit_meta_data["location_text"] = None
        db.add(RecruitMeta(post_id=db_post.id, **recruit_meta_data))

    db.commit()
    db.refresh(db_post)
    return db_post


def update_post(db: Session, post_id: int, post_update: PostUpdate) -> Optional[Post]:
    db_post = get_post(db, post_id)
    if not db_post:
        return None

    update_data = post_update.model_dump(exclude_unset=True, exclude={"recruit_meta"})
    recruit_meta_update_data = (
        post_update.recruit_meta.model_dump(exclude_unset=True)
        if post_update.recruit_meta is not None
        else None
    )

    for key, value in update_data.items():
        setattr(db_post, key, value)

    if db_post.post_type == POST_TYPE_RECRUIT:
        if recruit_meta_update_data is not None:
            recruit_meta = db_post.recruit_meta
            if recruit_meta is None:
                required_keys = {
                    "recruit_type",
                    "status",
                    "is_online",
                    "schedule_text",
                    "headcount_max",
                    "deadline_at",
                }
                if not required_keys.issubset(recruit_meta_update_data.keys()):
                    raise ValueError("모집 글로 전환할 때 모집 정보를 모두 입력해야 합니다.")

                if recruit_meta_update_data.get("is_online"):
                    recruit_meta_update_data["location_text"] = None

                db_post.recruit_meta = RecruitMeta(
                    post_id=db_post.id,
                    **recruit_meta_update_data,
                )
            else:
                for key, value in recruit_meta_update_data.items():
                    setattr(recruit_meta, key, value)
                if recruit_meta.is_online:
                    recruit_meta.location_text = None
        elif db_post.recruit_meta is None:
            raise ValueError("모집 글에는 모집 정보가 필요합니다.")
    else:
        if db_post.recruit_meta is not None:
            db.delete(db_post.recruit_meta)

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
