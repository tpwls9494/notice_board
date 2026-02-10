from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class DeadlinePostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    deadline_hours: float = Field(..., gt=0, le=24)


class DeadlinePostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)


class DeadlinePostResponse(BaseModel):
    id: int
    title: str
    content: str
    user_id: int
    deadline_at: datetime
    is_completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    author_username: Optional[str] = None
    remaining_seconds: Optional[float] = None
    is_expired: Optional[bool] = False
    is_urgent: Optional[bool] = False
    comment_count: Optional[int] = 0

    class Config:
        from_attributes = True


class DeadlinePostListResponse(BaseModel):
    total: int
    posts: List[DeadlinePostResponse]


class DeadlineCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class DeadlineCommentResponse(BaseModel):
    id: int
    content: str
    post_id: int
    user_id: int
    created_at: datetime
    author_username: Optional[str] = None

    class Config:
        from_attributes = True
