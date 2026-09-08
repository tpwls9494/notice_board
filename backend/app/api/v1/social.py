from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy import desc, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional, get_current_verified_user
from app.db.session import get_db
from app.models.signal import Signal
from app.models.social import (
    SocialComment,
    SocialCommentRecommendation,
    SocialPost,
    SocialPostSignal,
    SocialPostRecommendation,
)
from app.models.user import User
from app.models.user_block import UserBlock
from app.models.user_follow import UserFollow
from app.schemas.social import (
    CommunityImageResponse,
    SiteActivityResponse,
    SocialCommentCreate,
    SocialCommentResponse,
    SocialCommentUpdate,
    SocialPostCreate,
    SocialPostListResponse,
    SocialPostResponse,
    SocialPostUpdate,
)
from app.services.rate_limit import SlidingWindowRateLimiter
from app.services.site_activity import get_site_activity
from app.services import community_images


router = APIRouter()
post_write_limiter = SlidingWindowRateLimiter(window_seconds=3600, max_requests=20)
comment_write_limiter = SlidingWindowRateLimiter(window_seconds=60, max_requests=30)
image_upload_limiter = SlidingWindowRateLimiter(window_seconds=3600, max_requests=20)


def _clean_tags(tags: list[str] | None) -> list[str]:
    result = []
    seen = set()
    for tag in tags or []:
        clean = tag.strip()[:30]
        folded = clean.casefold()
        if clean and folded not in seen:
            seen.add(folded)
            result.append(clean)
    return result[:8]


def _blocked_user_ids(db: Session, user_id: int | None) -> set[int]:
    if user_id is None:
        return set()
    rows = (
        db.query(UserBlock.blocker_id, UserBlock.blocked_id)
        .filter(or_(UserBlock.blocker_id == user_id, UserBlock.blocked_id == user_id))
        .all()
    )
    return {
        blocked_id if blocker_id == user_id else blocker_id
        for blocker_id, blocked_id in rows
    }


def _post_metrics(db: Session, post_ids: list[int], user_id: int | None) -> tuple[dict[int, int], dict[int, int], set[int]]:
    if not post_ids:
        return {}, {}, set()
    recommendations = dict(
        db.query(SocialPostRecommendation.post_id, func.count(SocialPostRecommendation.id))
        .filter(SocialPostRecommendation.post_id.in_(post_ids))
        .group_by(SocialPostRecommendation.post_id)
        .all()
    )
    comments = dict(
        db.query(SocialComment.post_id, func.count(SocialComment.id))
        .filter(
            SocialComment.post_id.in_(post_ids),
            SocialComment.is_hidden == False,  # noqa: E712
            SocialComment.is_deleted == False,  # noqa: E712
        )
        .group_by(SocialComment.post_id)
        .all()
    )
    recommended = set()
    if user_id is not None:
        recommended = {
            post_id
            for (post_id,) in db.query(SocialPostRecommendation.post_id)
            .filter(
                SocialPostRecommendation.post_id.in_(post_ids),
                SocialPostRecommendation.user_id == user_id,
            )
            .all()
        }
    return recommendations, comments, recommended


def _serialize_posts(db: Session, posts: list[SocialPost], user_id: int | None) -> list[SocialPostResponse]:
    recommendations, comments, recommended = _post_metrics(db, [post.id for post in posts], user_id)
    links = {
        row.post_id: {"id": row.id, "slug": row.slug, "title": row.title}
        for row in db.query(SocialPostSignal.post_id, Signal.id, Signal.slug, Signal.title)
        .join(Signal, Signal.id == SocialPostSignal.signal_id)
        .filter(SocialPostSignal.post_id.in_([post.id for post in posts]), Signal.status == "published")
        .all()
    } if posts else {}
    return [
        SocialPostResponse(
            related_signal=links.get(post.id) if post.space == "community" else None,
            id=post.id,
            user_id=post.user_id,
            author_username=post.author.username,
            author_profile_image_url=post.author.profile_image_url,
            title=post.title,
            content=post.content,
            space=post.space,
            topic=post.topic,
            tags=post.tags or [],
            image_url=post.image_url,
            views=post.views or 0,
            recommendation_count=recommendations.get(post.id, 0),
            comment_count=comments.get(post.id, 0),
            is_recommended=post.id in recommended,
            created_at=post.created_at,
            updated_at=post.updated_at,
        )
        for post in posts
    ]


def _get_visible_post(db: Session, post_id: int) -> SocialPost:
    post = db.query(SocialPost).filter(SocialPost.id == post_id, SocialPost.is_hidden == False).first()  # noqa: E712
    if not post:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    return post


def _require_public_signal(db: Session, signal_id: int) -> None:
    if not db.query(Signal.id).filter(Signal.id == signal_id, Signal.status == "published").first():
        raise HTTPException(status_code=404, detail="연결할 소식을 찾을 수 없습니다.")


def _set_signal_link(db: Session, post: SocialPost, signal_id: int | None) -> None:
    if signal_id is not None:
        if post.space != "community":
            raise HTTPException(status_code=422, detail="관련 소식은 커뮤니티 글에 연결해 주세요.")
        _require_public_signal(db, signal_id)
    if signal_id is None:
        post.signal_link = None
    elif post.signal_link:
        post.signal_link.signal_id = signal_id
    else:
        post.signal_link = SocialPostSignal(signal_id=signal_id)


@router.post("/images", response_model=CommunityImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_community_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_verified_user),
):
    try:
        if not image_upload_limiter.allow(f"community-image:{user.id}"):
            raise HTTPException(status_code=429, detail="이미지 첨부 요청이 많습니다. 잠시 후 다시 시도해 주세요.")
        if file.content_type not in community_images.ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail="PNG, JPG, WebP 이미지만 첨부할 수 있습니다.")
        content = await file.read(community_images.MAX_UPLOAD_BYTES + 1)
        return await run_in_threadpool(community_images.save_community_image, content)
    finally:
        await file.close()


@router.get("/images/{filename}")
def read_community_image(filename: str):
    return FileResponse(
        community_images.community_image_path(filename),
        media_type="image/webp",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/stats", response_model=SiteActivityResponse)
def get_public_site_activity(db: Session = Depends(get_db)):
    return get_site_activity(db)


@router.get("/posts", response_model=SocialPostListResponse)
def list_social_posts(
    space: str = Query("community", pattern="^(community|lounge)$"),
    sort: str = Query("latest", pattern="^(latest|popular|following)$"),
    search: str | None = Query(None, max_length=100),
    signal_id: int | None = Query(None, gt=0),
    topic: str | None = Query(None, pattern="^(story|question|experience|tip|chat)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    query = db.query(SocialPost).filter(SocialPost.space == space, SocialPost.is_hidden == False)  # noqa: E712
    if signal_id is not None:
        _require_public_signal(db, signal_id)
        query = query.join(SocialPostSignal).filter(SocialPostSignal.signal_id == signal_id, SocialPost.space == "community")
    if topic:
        query = query.filter(SocialPost.topic == topic)
    blocked = _blocked_user_ids(db, current_user.id if current_user else None)
    if blocked:
        query = query.filter(~SocialPost.user_id.in_(blocked))
    if search:
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        needle = f"%{escaped}%"
        query = query.filter(
            or_(SocialPost.title.ilike(needle, escape="\\"), SocialPost.content.ilike(needle, escape="\\"))
        )
    if sort == "following":
        if not current_user:
            raise HTTPException(status_code=401, detail="팔로잉 글은 로그인 후 볼 수 있습니다.")
        following_ids = db.query(UserFollow.following_id).filter(UserFollow.follower_id == current_user.id)
        query = query.filter(SocialPost.user_id.in_(following_ids))
    if sort == "popular":
        query = query.filter(SocialPost.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
        recommendation_count = (
            db.query(func.count(SocialPostRecommendation.id))
            .filter(SocialPostRecommendation.post_id == SocialPost.id)
            .correlate(SocialPost)
            .scalar_subquery()
        )
        comment_count = (
            db.query(func.count(SocialComment.id))
            .filter(
                SocialComment.post_id == SocialPost.id,
                SocialComment.is_hidden == False,  # noqa: E712
                SocialComment.is_deleted == False,  # noqa: E712
            )
            .correlate(SocialPost)
            .scalar_subquery()
        )
        query = query.order_by(desc(recommendation_count * 3 + comment_count * 2 + SocialPost.views / 20), desc(SocialPost.created_at))
    else:
        query = query.order_by(desc(SocialPost.created_at), desc(SocialPost.id))
    total = query.count()
    posts = query.offset((page - 1) * page_size).limit(page_size).all()
    return SocialPostListResponse(
        items=_serialize_posts(db, posts, current_user.id if current_user else None),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/posts", response_model=SocialPostResponse, status_code=status.HTTP_201_CREATED)
def create_social_post(
    payload: SocialPostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    if not post_write_limiter.allow(f"social-post:{user.id}"):
        raise HTTPException(status_code=429, detail="글 작성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.")
    post = SocialPost(
        user_id=user.id,
        title=payload.title,
        content=payload.content,
        space=payload.space,
        topic=payload.topic,
        tags=_clean_tags(payload.tags),
        image_url=str(payload.image_url) if payload.image_url else None,
    )
    _set_signal_link(db, post, payload.related_signal_id)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize_posts(db, [post], user.id)[0]


@router.get("/posts/{post_id}", response_model=SocialPostResponse)
def get_social_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    post = _get_visible_post(db, post_id)
    if current_user and post.user_id in _blocked_user_ids(db, current_user.id):
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    post.views = (post.views or 0) + 1
    db.commit()
    db.refresh(post)
    return _serialize_posts(db, [post], current_user.id if current_user else None)[0]


@router.patch("/posts/{post_id}", response_model=SocialPostResponse)
def update_social_post(
    post_id: int,
    payload: SocialPostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    post = _get_visible_post(db, post_id)
    if post.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="글을 수정할 권한이 없습니다.")
    data = payload.model_dump(exclude_unset=True)
    has_signal_update = "related_signal_id" in data
    related_signal_id = data.pop("related_signal_id", None)
    if "image_url" in data:
        data["image_url"] = str(data["image_url"]) if data["image_url"] else None
    if "tags" in data:
        data["tags"] = _clean_tags(data["tags"])
    for key, value in data.items():
        setattr(post, key, value.strip() if isinstance(value, str) else value)
    if has_signal_update:
        _set_signal_link(db, post, related_signal_id)
    elif post.space == "lounge":
        _set_signal_link(db, post, None)
    db.commit()
    db.refresh(post)
    return _serialize_posts(db, [post], user.id)[0]


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_social_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    post = _get_visible_post(db, post_id)
    if post.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="글을 삭제할 권한이 없습니다.")
    db.delete(post)
    db.commit()
    return Response(status_code=204)


@router.post("/posts/{post_id}/recommend", status_code=status.HTTP_204_NO_CONTENT)
def recommend_social_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    _get_visible_post(db, post_id)
    db.add(SocialPostRecommendation(post_id=post_id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return Response(status_code=204)


@router.delete("/posts/{post_id}/recommend", status_code=status.HTTP_204_NO_CONTENT)
def unrecommend_social_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    db.query(SocialPostRecommendation).filter(
        SocialPostRecommendation.post_id == post_id,
        SocialPostRecommendation.user_id == user.id,
    ).delete()
    db.commit()
    return Response(status_code=204)


def _serialize_comments(db: Session, rows: list[SocialComment], user_id: int | None) -> list[SocialCommentResponse]:
    ids = [row.id for row in rows]
    counts = dict(
        db.query(SocialCommentRecommendation.comment_id, func.count(SocialCommentRecommendation.id))
        .filter(SocialCommentRecommendation.comment_id.in_(ids))
        .group_by(SocialCommentRecommendation.comment_id)
        .all()
    ) if ids else {}
    recommended = set()
    if user_id is not None and ids:
        recommended = {
            comment_id
            for (comment_id,) in db.query(SocialCommentRecommendation.comment_id)
            .filter(
                SocialCommentRecommendation.comment_id.in_(ids),
                SocialCommentRecommendation.user_id == user_id,
            )
            .all()
        }
    return [
        SocialCommentResponse(
            id=row.id,
            post_id=row.post_id,
            user_id=row.user_id,
            parent_id=row.parent_id,
            author_username=row.author.username,
            author_profile_image_url=row.author.profile_image_url,
            content="삭제된 댓글입니다." if row.is_deleted else row.content,
            is_deleted=bool(row.is_deleted),
            recommendation_count=counts.get(row.id, 0),
            is_recommended=row.id in recommended,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.get("/posts/{post_id}/comments", response_model=list[SocialCommentResponse])
def list_social_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    _get_visible_post(db, post_id)
    blocked = _blocked_user_ids(db, current_user.id if current_user else None)
    query = db.query(SocialComment).filter(
        SocialComment.post_id == post_id,
        SocialComment.is_hidden == False,  # noqa: E712
    )
    if blocked:
        query = query.filter(~SocialComment.user_id.in_(blocked))
    rows = query.order_by(SocialComment.created_at, SocialComment.id).all()
    needed_parents = {row.parent_id for row in rows if not row.is_deleted and row.parent_id is not None}
    rows = [row for row in rows if not row.is_deleted or row.id in needed_parents]
    return _serialize_comments(db, rows, current_user.id if current_user else None)


@router.post("/posts/{post_id}/comments", response_model=SocialCommentResponse, status_code=status.HTTP_201_CREATED)
def create_social_comment(
    post_id: int,
    payload: SocialCommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    _get_visible_post(db, post_id)
    if not comment_write_limiter.allow(f"social-comment:{user.id}"):
        raise HTTPException(status_code=429, detail="댓글 작성 요청이 너무 많습니다.")
    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(SocialComment).filter(
            SocialComment.id == parent_id,
            SocialComment.post_id == post_id,
            SocialComment.is_hidden == False,  # noqa: E712
        ).first()
        if not parent or parent.is_deleted:
            raise HTTPException(status_code=404, detail="답글을 남길 댓글을 찾을 수 없습니다.")
        parent_id = parent.parent_id or parent.id
    comment = SocialComment(post_id=post_id, user_id=user.id, parent_id=parent_id, content=payload.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _serialize_comments(db, [comment], user.id)[0]


@router.patch("/comments/{comment_id}", response_model=SocialCommentResponse)
def update_social_comment(
    comment_id: int,
    payload: SocialCommentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    comment = db.query(SocialComment).filter(SocialComment.id == comment_id).first()
    if not comment or comment.is_hidden or comment.is_deleted:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="댓글을 수정할 권한이 없습니다.")
    comment.content = payload.content.strip()
    db.commit()
    db.refresh(comment)
    return _serialize_comments(db, [comment], user.id)[0]


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_social_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    comment = db.query(SocialComment).filter(SocialComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="댓글을 삭제할 권한이 없습니다.")
    if user.is_admin and comment.user_id != user.id:
        comment.is_hidden = True
    else:
        comment.is_deleted = True
        comment.content = ""
    db.commit()
    return Response(status_code=204)


@router.post("/comments/{comment_id}/recommend", status_code=status.HTTP_204_NO_CONTENT)
def recommend_social_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    comment = db.query(SocialComment).filter(
        SocialComment.id == comment_id,
        SocialComment.is_hidden == False,  # noqa: E712
        SocialComment.is_deleted == False,  # noqa: E712
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    db.add(SocialCommentRecommendation(comment_id=comment_id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return Response(status_code=204)


@router.delete("/comments/{comment_id}/recommend", status_code=status.HTTP_204_NO_CONTENT)
def unrecommend_social_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    db.query(SocialCommentRecommendation).filter(
        SocialCommentRecommendation.comment_id == comment_id,
        SocialCommentRecommendation.user_id == user.id,
    ).delete()
    db.commit()
    return Response(status_code=204)
