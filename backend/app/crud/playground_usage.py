from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.playground_usage import PlaygroundUsage


def create_usage(db: Session, user_id: int, server_id: int, tool_name: str, execution_time_ms: float = None):
    usage = PlaygroundUsage(
        user_id=user_id,
        server_id=server_id,
        tool_name=tool_name,
        execution_time_ms=execution_time_ms,
    )
    db.add(usage)
    db.commit()
    return usage


def get_user_usage_count(db: Session, user_id: int) -> int:
    return db.query(PlaygroundUsage).filter(PlaygroundUsage.user_id == user_id).count()


def get_user_usages(db: Session, user_id: int, skip: int = 0, limit: int = 20):
    return (
        db.query(PlaygroundUsage)
        .filter(PlaygroundUsage.user_id == user_id)
        .order_by(desc(PlaygroundUsage.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
