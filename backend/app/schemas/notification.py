from datetime import datetime
from typing import List, Optional
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
    post_title: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: bool


class NotificationListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    notifications: List[NotificationResponse]


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
