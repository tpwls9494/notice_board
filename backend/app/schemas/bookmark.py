from datetime import datetime
from typing import List, Optional
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


class BookmarkPostSummary(BaseModel):
    id: int
    title: str
    category_name: Optional[str] = None
    author_username: Optional[str] = None
    created_at: datetime
    views: int
    likes_count: int = 0
    comment_count: int = 0


class BookmarkListItem(BaseModel):
    id: int
    post_id: int
    user_id: int
    created_at: datetime
    post: BookmarkPostSummary


class BookmarkListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    bookmarks: List[BookmarkListItem]


class BookmarkStatusResponse(BaseModel):
    post_id: int
    is_bookmarked: bool
