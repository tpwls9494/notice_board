from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.signal import Signal
from app.models.social import SocialPost
from app.schemas.social import SiteActivityResponse


KOREA_TIME = timezone(timedelta(hours=9))


def get_site_activity(db: Session, *, now: datetime | None = None) -> SiteActivityResponse:
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    now_korea = now_utc.astimezone(KOREA_TIME)
    day_start = now_korea.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - timedelta(days=day_start.weekday())

    today_signals = db.query(func.count(Signal.id)).filter(
        Signal.status == "published",
        Signal.published_at >= day_start.astimezone(timezone.utc),
        Signal.published_at <= now_utc,
    ).scalar()
    week_experiences = db.query(func.count(SocialPost.id)).filter(
        SocialPost.space == "community",
        SocialPost.topic == "experience",
        SocialPost.is_hidden.is_(False),
        SocialPost.created_at >= week_start.astimezone(timezone.utc),
        SocialPost.created_at <= now_utc,
    ).scalar()

    return SiteActivityResponse(
        date=now_korea.date(),
        week_start=week_start.date(),
        today_signals=int(today_signals or 0),
        week_experiences=int(week_experiences or 0),
        updated_at=now_utc,
    )
