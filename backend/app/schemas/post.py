from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PostBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category_id: Optional[int] = None


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    category_id: Optional[int] = None


class PostResponse(PostBase):
    id: int
    views: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    author_username: Optional[str] = None
    comment_count: Optional[int] = 0
    likes_count: Optional[int] = 0
    is_liked: Optional[bool] = False
    category_name: Optional[str] = None

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    posts: List[PostResponse]
