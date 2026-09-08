import copy
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_active_admin, get_current_user, get_current_user_optional, get_current_verified_user
from app.core.config import settings
from app.crud import signal as crud_signal
from app.db.session import get_db
from app.models.signal import Signal, SignalComment, SignalRecommendation
from app.models.user import User
from app.schemas.signal import (
    InterestResponse,
    InterestUpdate,
    SignalAdminUpdate,
    SignalCommentCreate,
    SignalCommentModeration,
    SignalCommentResponse,
    SignalCommentUpdate,
    SignalCreate,
    SignalListResponse,
    SignalResponse,
    SignalReviewUpdate,
)
from app.services.rate_limit import SlidingWindowRateLimiter

router = APIRouter()
comment_limiter = SlidingWindowRateLimiter(
    window_seconds=60,
    max_requests=settings.SIGNAL_COMMENT_RATE_LIMIT_PER_MINUTE,
)
ingest_limiter = SlidingWindowRateLimiter(window_seconds=60, max_requests=60)


def _serialize_signal(
    db: Session,
    signal: Signal,
    known_comment_count: int | None = None,
    known_recommendation_count: int | None = None,
    is_recommended: bool = False,
) -> SignalResponse:
    return SignalResponse(
        id=signal.id,
        slug=signal.slug,
        title=signal.title,
        summary=signal.summary,
        body=signal.body,
        original_title=signal.original_title,
        image_url=signal.image_url,
        why_it_matters=signal.why_it_matters,
        try_this=signal.try_this,
        content_kind=signal.content_kind,
        status=signal.status,
        verification_level=signal.verification_level,
        source_kind=signal.source_kind,
        source_name=signal.source_name,
        source_url=signal.source_url,
        source_published_at=signal.source_published_at,
        evidence=signal.evidence or [],
        tags=signal.tags or [],
        confidence_score=signal.confidence_score or 0,
        novelty_score=signal.novelty_score or 0,
        usefulness_score=signal.usefulness_score or 0,
        importance_score=signal.importance_score or 0,
        external_reactions=signal.external_reactions or 0,
        ranking_recommendations=getattr(signal, "ranking_recommendations", 0),
        ranking_commenters=getattr(signal, "ranking_commenters", 0),
        ranking_participants=getattr(signal, "ranking_participants", 0),
        ranking_score=getattr(signal, "ranking_score", 0),
        recommendation_count=(
            known_recommendation_count
            if known_recommendation_count is not None
            else crud_signal.recommendation_metrics(db, [signal.id], None)[0].get(signal.id, 0)
        ),
        is_recommended=is_recommended,
        is_featured=bool(signal.is_featured),
        views=signal.views or 0,
        comment_count=(
            known_comment_count
            if known_comment_count is not None
            else crud_signal.comment_count(db, signal.id)
        ),
        published_at=signal.published_at,
        pinned_until=signal.pinned_until,
        created_at=signal.created_at,
        updated_at=signal.updated_at,
    )


def _serialize_signal_list(db: Session, items: list[Signal], user_id: int | None = None) -> list[SignalResponse]:
    counts = crud_signal.comment_counts(db, [item.id for item in items])
    recommendation_counts, recommended = crud_signal.recommendation_metrics(db, [item.id for item in items], user_id)
    return [
        _serialize_signal(
            db,
            item,
            counts.get(item.id, 0),
            recommendation_counts.get(item.id, 0),
            item.id in recommended,
        )
        for item in items
    ]


def _require_signal_bot_token(token: str | None) -> None:
    expected = (settings.SIGNAL_BOT_TOKEN or "").strip()
    provided = (token or "").strip()
    if not expected or not provided or not secrets.compare_digest(expected, provided):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효한 수집기 토큰이 필요합니다.",
        )


def _validate_publishable(signal: Signal, verification_level: str | None = None) -> None:
    level = verification_level or signal.verification_level
    missing = []
    if not signal.title.strip() or signal.title.startswith("검토 필요 ·"):
        missing.append("제목")
    if len(signal.summary.strip()) < 10:
        missing.append("요약")
    if not (signal.body or "").strip() and not (signal.why_it_matters or "").strip():
        missing.append("본문 또는 활용 포인트")
    if signal.content_kind == "workflow" and not (signal.try_this or "").strip():
        missing.append("지금 해볼 것")
    if not (signal.source_name or "").strip() or not (signal.source_kind or "").strip():
        missing.append("출처")
    if level == "unverified":
        missing.append("검증 수준")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"공개 전에 다음 항목을 완성해 주세요: {', '.join(missing)}",
        )


@router.get("/", response_model=SignalListResponse)
def list_signals(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    kind: str | None = Query(None, pattern="^(release|workflow|research)$"),
    search: str | None = Query(None, max_length=100),
    sort: str = Query("latest", pattern="^(latest|new|useful|important|popular|trending)$"),
    exclude_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    items, total = crud_signal.get_signals(
        db,
        page=page,
        page_size=page_size,
        content_kind=kind,
        exclude_id=exclude_id,
        search=search,
        sort=sort,
    )
    return SignalListResponse(
        items=_serialize_signal_list(db, items, current_user.id if current_user else None),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/review-queue", response_model=SignalListResponse)
def review_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    items, total = crud_signal.get_signals(
        db, page=page, page_size=page_size, status=["candidate", "review"], sort="latest"
    )
    return SignalListResponse(
        items=_serialize_signal_list(db, items, admin.id),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=SignalResponse, status_code=status.HTTP_201_CREATED)
def create_signal(
    payload: SignalCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    if payload.status == "published":
        preview = Signal(**payload.model_dump(exclude={"source_url"}), source_url=str(payload.source_url))
        _validate_publishable(preview)
    try:
        signal = crud_signal.create_signal(db, payload, submitted_by_id=admin.id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 수집된 출처입니다.")
    return _serialize_signal(db, signal)


@router.post("/ingest", response_model=SignalResponse, status_code=status.HTTP_201_CREATED)
def ingest_signal(
    payload: SignalCreate,
    db: Session = Depends(get_db),
    bot_token: str | None = Header(None, alias="X-Signal-Bot-Token"),
):
    """Ingest from automation; sourced items publish while unverified items wait."""
    _require_signal_bot_token(bot_token)
    if not ingest_limiter.allow("signal-ingest"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="수집 요청이 너무 많습니다.",
            headers={"Retry-After": "60"},
        )
    auto_publish = (
        payload.verification_level in {"official", "cross_checked", "community"}
        # Long-form editorial content must be reviewed by an administrator.
        and not (payload.body or "").strip()
        and bool((payload.why_it_matters or "").strip())
        and bool((payload.try_this or "").strip())
    )
    safe_payload = payload.model_copy(update={"status": "published" if auto_publish else "review"})
    try:
        signal = crud_signal.create_signal(db, safe_payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 수집한 출처입니다.")
    return _serialize_signal(db, signal)


@router.get("/me/interests", response_model=InterestResponse)
def get_my_interests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    return InterestResponse(keywords=crud_signal.get_interests(db, user.id))


@router.put("/me/interests", response_model=InterestResponse)
def update_my_interests(
    payload: InterestUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    return InterestResponse(keywords=crud_signal.replace_interests(db, user.id, payload.keywords))


@router.patch("/{signal_id}", response_model=SignalResponse)
def update_signal_content(
    signal_id: int,
    payload: SignalAdminUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_admin),
):
    signal = crud_signal.get_signal(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    if signal.status == "published":
        preview = copy.copy(signal)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(preview, key, str(value) if key == "source_url" else value)
        _validate_publishable(preview)
    try:
        updated = crud_signal.update_signal(db, signal, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 수집한 출처입니다.")
    return _serialize_signal(db, updated)


@router.post("/{slug}/recommend", status_code=status.HTTP_204_NO_CONTENT)
def recommend_signal(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    signal = crud_signal.get_signal_by_slug(db, slug)
    if not signal or signal.status != "published":
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    db.add(SignalRecommendation(signal_id=signal.id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return Response(status_code=204)


@router.delete("/{slug}/recommend", status_code=status.HTTP_204_NO_CONTENT)
def unrecommend_signal(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    signal = crud_signal.get_signal_by_slug(db, slug)
    if not signal or signal.status != "published":
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    db.query(SignalRecommendation).filter(
        SignalRecommendation.signal_id == signal.id,
        SignalRecommendation.user_id == user.id,
    ).delete()
    db.commit()
    return Response(status_code=204)


@router.get("/{slug}", response_model=SignalResponse)
def get_signal(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    signal = crud_signal.get_signal_by_slug(db, slug)
    if not signal or signal.status != "published":
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    signal.views = (signal.views or 0) + 1
    db.commit()
    db.refresh(signal)
    response = _serialize_signal_list(db, [signal], current_user.id if current_user else None)[0]
    return response


@router.patch("/{signal_id}/review", response_model=SignalResponse)
def review_signal(
    signal_id: int,
    payload: SignalReviewUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    signal = crud_signal.get_signal(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    if payload.action == "publish":
        _validate_publishable(signal, payload.verification_level)
    reviewed = crud_signal.review_signal(
        db,
        signal,
        reviewer_id=admin.id,
        action=payload.action,
        note=payload.note,
        verification_level=payload.verification_level,
    )
    return _serialize_signal(db, reviewed)


@router.get("/{slug}/comments", response_model=list[SignalCommentResponse])
def list_comments(slug: str, db: Session = Depends(get_db)):
    signal = crud_signal.get_signal_by_slug(db, slug)
    if not signal or signal.status != "published":
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    rows = (
        db.query(SignalComment)
        .options(joinedload(SignalComment.author))
        .filter(SignalComment.signal_id == signal.id)
        .order_by(SignalComment.created_at, SignalComment.id)
        .all()
    )
    visible_ids = {row.id for row in rows if not row.is_hidden and not row.is_deleted}
    needed_parents = {row.parent_id for row in rows if row.id in visible_ids and row.parent_id is not None}
    return [_serialize_comment(row) for row in rows if row.id in visible_ids or row.id in needed_parents]


def _serialize_comment(comment: SignalComment) -> SignalCommentResponse:
    # Keep replies readable without exposing the text/identity of moderated parents.
    hidden = bool(comment.is_hidden)
    deleted = bool(comment.is_deleted)
    return SignalCommentResponse(
        id=comment.id, signal_id=comment.signal_id,
        user_id=None if hidden else comment.user_id, parent_id=comment.parent_id,
        author_username="관리자 숨김" if hidden else comment.author.username,
        author_profile_image_url=None if hidden else comment.author.profile_image_url,
        kind="question" if hidden else comment.kind,
        content="숨김 처리된 댓글입니다." if hidden else "삭제된 댓글입니다." if deleted else comment.content,
        is_hidden=hidden, is_deleted=deleted,
        created_at=comment.created_at, updated_at=None if hidden else comment.updated_at,
    )


@router.post(
    "/{slug}/comments",
    response_model=SignalCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    slug: str,
    payload: SignalCommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    signal = crud_signal.get_signal_by_slug(db, slug)
    if not signal or signal.status != "published":
        raise HTTPException(status_code=404, detail="정보를 찾을 수 없습니다.")
    if not comment_limiter.allow(f"comment:{user.id}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="댓글 작성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            headers={"Retry-After": "60"},
        )
    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(SignalComment).filter(
            SignalComment.id == parent_id, SignalComment.signal_id == signal.id,
            SignalComment.is_hidden.is_(False), SignalComment.is_deleted.is_(False),
        ).with_for_update().first()
        if not parent:
            raise HTTPException(status_code=404, detail="답글을 남길 댓글을 찾을 수 없습니다.")
        parent_id = parent.parent_id or parent.id
        root = db.query(SignalComment).filter(
            SignalComment.id == parent_id, SignalComment.signal_id == signal.id,
            SignalComment.is_hidden.is_(False), SignalComment.is_deleted.is_(False),
        ).with_for_update().first()
        if not root:
            raise HTTPException(status_code=404, detail="답글을 남길 댓글을 찾을 수 없습니다.")
    comment = SignalComment(
        signal_id=signal.id,
        user_id=user.id,
        parent_id=parent_id,
        kind=payload.kind,
        content=payload.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _serialize_comment(comment)


@router.patch("/comments/{comment_id}", response_model=SignalCommentResponse)
def update_signal_comment(
    comment_id: int,
    payload: SignalCommentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_verified_user),
):
    comment = db.query(SignalComment).join(Signal).filter(
        SignalComment.id == comment_id, Signal.status == "published",
        SignalComment.is_hidden.is_(False), SignalComment.is_deleted.is_(False),
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="댓글을 수정할 권한이 없습니다.")
    comment.content = payload.content
    comment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return _serialize_comment(comment)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_signal_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.query(SignalComment).filter(SignalComment.id == comment_id).first()
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/comments/{comment_id}/moderation", status_code=status.HTTP_204_NO_CONTENT)
def moderate_signal_comment(
    comment_id: int,
    payload: SignalCommentModeration,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_admin),
):
    comment = db.query(SignalComment).filter(SignalComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    comment.is_hidden = payload.hidden
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
