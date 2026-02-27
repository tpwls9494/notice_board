from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CommentBase(BaseModel):
    content: str = Field(..., min_length=1)


class CommentCreate(CommentBase):
    post_id: int


class CommentResponse(CommentBase):
    id: int
    post_id: int
    user_id: int
    created_at: datetime
    author_username: Optional[str] = None
    author_profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True
