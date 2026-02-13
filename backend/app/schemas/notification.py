from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationCreate(BaseModel):
    user_id: int
    type: str
    content: str
    related_post_id: Optional[int] = None
    related_comment_id: Optional[int] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    content: str
    related_post_id: Optional[int]
    related_comment_id: Optional[int]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: bool
