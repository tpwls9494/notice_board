import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, distinct, func
from sqlalchemy.orm import Session

from app.models.analytics_event import AnalyticsEvent


def create_event(
    db: Session,
    event_name: str,
    user_id: int | None,
    page: str | None,
    referrer: str | None,
    properties: dict | None,
) -> AnalyticsEvent:
    event = AnalyticsEvent(
        event_name=event_name,
        user_id=user_id,
        page=page,
        referrer=referrer,
        properties_json=json.dumps(properties or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_summary(
    db: Session,
    days: int = 7,
    limit: int = 20,
) -> dict:
    now_utc = datetime.now(timezone.utc)
    from_date = now_utc - timedelta(days=days)

    base_query = db.query(AnalyticsEvent).filter(AnalyticsEvent.created_at >= from_date)

    total_events = base_query.count()
    unique_users = (
        db.query(func.count(distinct(AnalyticsEvent.user_id)))
        .filter(
            AnalyticsEvent.created_at >= from_date,
            AnalyticsEvent.user_id.isnot(None),
        )
        .scalar()
        or 0
    )

    by_event_rows = (
        db.query(
            AnalyticsEvent.event_name,
            func.count(AnalyticsEvent.id).label("count"),
        )
        .filter(AnalyticsEvent.created_at >= from_date)
        .group_by(AnalyticsEvent.event_name)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    return {
        "from_date": from_date,
        "to_date": now_utc,
        "total_events": total_events,
        "unique_users": int(unique_users),
        "by_event": [
            {
                "event_name": row[0],
                "count": int(row[1]),
            }
            for row in by_event_rows
        ],
    }
