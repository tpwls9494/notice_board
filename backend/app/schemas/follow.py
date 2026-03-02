from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class FollowResponse(BaseModel):
    id: int
    follower_id: int
    following_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FollowStatusResponse(BaseModel):
    user_id: int
    is_following: bool


class FollowUserSummary(BaseModel):
    user_id: int
    username: str
    profile_image_url: Optional[str] = None
    followed_at: datetime


class FollowUserListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    users: List[FollowUserSummary]
