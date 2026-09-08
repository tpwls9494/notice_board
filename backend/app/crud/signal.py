import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import case, desc, func, literal, or_, union_all
from sqlalchemy.orm import Session

from app.models.signal import Signal, SignalComment, SignalRecommendation, SignalReview, UserInterest
from app.schemas.signal import SignalAdminUpdate, SignalCreate


TRACKING_QUERY_KEYS = {"fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "ref", "source"}


def canonical_source_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    host = (parsed.hostname or "").casefold()
    if host.startswith("www."):
        host = host[4:]
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    port = parsed.port
    if port and not ((parsed.scheme.casefold() == "http" and port == 80) or (parsed.scheme.casefold() == "https" and port == 443)):
        host = f"{host}:{port}"
    path = parsed.path.rstrip("/") or "/"
    query = urlencode(
        sorted(
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.casefold().startswith("utm_") and key.casefold() not in TRACKING_QUERY_KEYS
        ),
        doseq=True,
    )
    # The scheme is deliberately omitted so http/https variants share a hash.
    return urlunsplit(("", host, path, query, ""))


def canonical_source_hash(url: str) -> str:
    normalized = canonical_source_url(url)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^0-9a-zA-Z가-힣\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value[:220] or "ai-signal"


def unique_slug(db: Session, title: str, *, exclude_signal_id: int | None = None) -> str:
    base = _slugify(title)
    candidate = base
    query = db.query(Signal.id).filter(Signal.slug == candidate)
    if exclude_signal_id is not None:
        query = query.filter(Signal.id != exclude_signal_id)
    if not query.first():
        return candidate
    while True:
        candidate = f"{base[:210]}-{secrets.token_hex(4)}"
        query = db.query(Signal.id).filter(Signal.slug == candidate)
        if exclude_signal_id is not None:
            query = query.filter(Signal.id != exclude_signal_id)
        if not query.first():
            return candidate


def create_signal(db: Session, payload: SignalCreate, submitted_by_id: Optional[int] = None) -> Signal:
    data = payload.model_dump()
    data["source_url"] = str(data["source_url"])
    data["image_url"] = str(data["image_url"]) if data.get("image_url") else None
    data["evidence"] = [str(url) for url in data.get("evidence", [])]
    data["source_hash"] = canonical_source_hash(data["source_url"])
    data["slug"] = unique_slug(db, payload.title)
    if data["status"] == "published":
        data["published_at"] = datetime.now(timezone.utc)
    signal = Signal(**data, submitted_by_id=submitted_by_id)
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


def update_signal(db: Session, signal: Signal, payload: SignalAdminUpdate) -> Signal:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and signal.status != "published":
        data["slug"] = unique_slug(db, data["title"], exclude_signal_id=signal.id)
    if "source_url" in data:
        data["source_url"] = str(data["source_url"])
        data["source_hash"] = canonical_source_hash(data["source_url"])
    if "image_url" in data:
        data["image_url"] = str(data["image_url"]) if data["image_url"] else None
    if data.get("evidence") is not None:
        data["evidence"] = [str(url) for url in data["evidence"]]
    if data.get("tags") is not None:
        data["tags"] = list(dict.fromkeys(tag.strip()[:40] for tag in data["tags"] if tag.strip()))
    for key, value in data.items():
        setattr(signal, key, value)
    db.commit()
    db.refresh(signal)
    return signal


def get_signal(db: Session, signal_id: int) -> Optional[Signal]:
    return db.query(Signal).filter(Signal.id == signal_id).first()


def get_signal_by_slug(db: Session, slug: str) -> Optional[Signal]:
    return db.query(Signal).filter(Signal.slug == slug).first()


def get_signals(
    db: Session,
    *,
    page: int,
    page_size: int,
    content_kind: Optional[str] = None,
    search: Optional[str] = None,
    status: str | list[str] = "published",
    sort: str = "latest",
    exclude_id: int | None = None,
) -> tuple[list[Signal], int]:
    query = db.query(Signal)
    if isinstance(status, list):
        query = query.filter(Signal.status.in_(status))
    else:
        query = query.filter(Signal.status == status)
    if content_kind:
        query = query.filter(Signal.content_kind == content_kind)
    if exclude_id is not None:
        query = query.filter(Signal.id != exclude_id)
    if search:
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        needle = f"%{escaped}%"
        query = query.filter(
            or_(Signal.title.ilike(needle, escape="\\"), Signal.summary.ilike(needle, escape="\\"))
        )
    if sort in {"popular", "trending"}:
        now = datetime.now(timezone.utc)
        recommendations = db.query(
            SignalRecommendation.signal_id.label("signal_id"),
            SignalRecommendation.user_id.label("user_id"), literal(1).label("is_recommendation"),
        ).join(Signal, Signal.id == SignalRecommendation.signal_id).filter(
            SignalRecommendation.created_at <= now,
            or_(Signal.submitted_by_id.is_(None), SignalRecommendation.user_id != Signal.submitted_by_id),
        )
        commenters = db.query(
            SignalComment.signal_id.label("signal_id"),
            SignalComment.user_id.label("user_id"), literal(0).label("is_recommendation"),
        ).join(Signal, Signal.id == SignalComment.signal_id).filter(
            SignalComment.is_hidden.is_(False), SignalComment.is_deleted.is_(False),
            SignalComment.created_at <= now,
            or_(Signal.submitted_by_id.is_(None), SignalComment.user_id != Signal.submitted_by_id),
        )
        if sort == "trending":
            cutoff = now - timedelta(hours=6)
            recommendations = recommendations.filter(SignalRecommendation.created_at >= cutoff)
            commenters = commenters.filter(SignalComment.created_at >= cutoff)
        # One comment contribution per person, regardless of the number of replies.
        events = union_all(recommendations.statement, commenters.distinct().statement).subquery()
        recs = func.sum(events.c.is_recommendation)
        comments = func.sum(case((events.c.is_recommendation == 0, 1), else_=0))
        participants = func.count(func.distinct(events.c.user_id))
        ranking = db.query(events.c.signal_id, recs.label("recommendations"),
                           comments.label("commenters"), participants.label("participants"),
                           (recs * 2 + comments).label("score")).group_by(events.c.signal_id).having(participants >= 2).subquery()
        ranked = query.join(ranking, ranking.c.signal_id == Signal.id)
        total = ranked.count()
        rows = ranked.add_columns(ranking.c.recommendations, ranking.c.commenters, ranking.c.participants, ranking.c.score).order_by(
            ranking.c.score.desc(), ranking.c.participants.desc(),
            Signal.published_at.desc().nullslast(), Signal.id.desc(),
        ).offset((page - 1) * page_size).limit(page_size).all()
        items = []
        for signal, rec_count, commenter_count, participant_count, score in rows:
            signal.ranking_recommendations = int(rec_count)
            signal.ranking_commenters = int(commenter_count)
            signal.ranking_participants = int(participant_count)
            signal.ranking_score = int(score)
            items.append(signal)
        return items, total
    if sort == "important":
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        query = query.filter(
            or_(
                Signal.pinned_until >= datetime.now(timezone.utc),
                Signal.source_published_at >= cutoff,
                Signal.published_at >= cutoff,
            )
        )
    total = query.count()
    if sort == "important":
        recommendation_count = (
            db.query(func.count(SignalRecommendation.id))
            .filter(SignalRecommendation.signal_id == Signal.id)
            .correlate(Signal)
            .scalar_subquery()
        )
        query = query.order_by(
            desc(Signal.is_featured),
            desc(Signal.pinned_until).nullslast(),
            desc(Signal.importance_score),
            desc(recommendation_count),
            desc(Signal.external_reactions),
            desc(Signal.published_at),
        )
    elif sort == "useful":
        query = query.order_by(desc(Signal.usefulness_score), desc(Signal.published_at))
    elif sort == "new":
        query = query.order_by(
            desc(Signal.source_published_at).nullslast(),
            desc(Signal.published_at),
        )
    else:
        query = query.order_by(desc(Signal.published_at), desc(Signal.created_at), desc(Signal.id))
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def comment_count(db: Session, signal_id: int) -> int:
    return (
        db.query(func.count(SignalComment.id))
        .filter(SignalComment.signal_id == signal_id, SignalComment.is_hidden.is_(False), SignalComment.is_deleted.is_(False))
        .scalar()
        or 0
    )


def comment_counts(db: Session, signal_ids: list[int]) -> dict[int, int]:
    if not signal_ids:
        return {}
    rows = (
        db.query(SignalComment.signal_id, func.count(SignalComment.id))
        .filter(SignalComment.signal_id.in_(signal_ids), SignalComment.is_hidden.is_(False), SignalComment.is_deleted.is_(False))
        .group_by(SignalComment.signal_id)
        .all()
    )
    return {signal_id: count for signal_id, count in rows}


def recommendation_metrics(
    db: Session,
    signal_ids: list[int],
    user_id: int | None,
) -> tuple[dict[int, int], set[int]]:
    if not signal_ids:
        return {}, set()
    counts = dict(
        db.query(SignalRecommendation.signal_id, func.count(SignalRecommendation.id))
        .filter(SignalRecommendation.signal_id.in_(signal_ids))
        .group_by(SignalRecommendation.signal_id)
        .all()
    )
    recommended = set()
    if user_id is not None:
        recommended = {
            signal_id
            for (signal_id,) in db.query(SignalRecommendation.signal_id)
            .filter(
                SignalRecommendation.signal_id.in_(signal_ids),
                SignalRecommendation.user_id == user_id,
            )
            .all()
        }
    return counts, recommended


def review_signal(
    db: Session,
    signal: Signal,
    *,
    reviewer_id: int,
    action: str,
    note: Optional[str],
    verification_level: Optional[str],
) -> Signal:
    status_by_action = {
        "publish": "published",
        "hold": "review",
        "reject": "rejected",
        "archive": "archived",
    }
    signal.status = status_by_action[action]
    signal.reviewed_by_id = reviewer_id
    signal.review_note = note
    if verification_level:
        signal.verification_level = verification_level
    if action == "publish" and signal.published_at is None:
        signal.published_at = datetime.now(timezone.utc)
    db.add(SignalReview(signal_id=signal.id, reviewer_id=reviewer_id, action=action, note=note))
    db.commit()
    db.refresh(signal)
    return signal


def replace_interests(db: Session, user_id: int, keywords: list[str]) -> list[str]:
    normalized = []
    seen = set()
    for keyword in keywords:
        clean = keyword.strip()[:80]
        folded = clean.casefold()
        if clean and folded not in seen:
            seen.add(folded)
            normalized.append(clean)
    db.query(UserInterest).filter(UserInterest.user_id == user_id).delete()
    db.add_all(UserInterest(user_id=user_id, keyword=keyword) for keyword in normalized)
    db.commit()
    return normalized


def get_interests(db: Session, user_id: int) -> list[str]:
    rows = (
        db.query(UserInterest)
        .filter(UserInterest.user_id == user_id)
        .order_by(UserInterest.created_at, UserInterest.id)
        .all()
    )
    return [row.keyword for row in rows]
