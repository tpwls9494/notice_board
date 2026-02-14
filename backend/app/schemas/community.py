from pydantic import BaseModel
from typing import Optional


class CommunityStatsResponse(BaseModel):
    today_posts: int
    today_comments: int
    active_users: Optional[int] = None
