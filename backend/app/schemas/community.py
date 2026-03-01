from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.schemas.post import PostResponse


class CommunityStatsResponse(BaseModel):
    today_posts: int
    today_comments: int
    today_signups: int
    active_users: Optional[int] = None


class CommunityWeeklySummaryResponse(BaseModel):
    window: str = "7d"
    period_start: datetime
    period_end: datetime
    generated_at: datetime
    posts: list[PostResponse]
