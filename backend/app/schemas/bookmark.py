from datetime import datetime
from pydantic import BaseModel


class BookmarkCreate(BaseModel):
    post_id: int


class BookmarkResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
