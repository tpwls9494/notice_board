from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    tags: Optional[str] = Field(None, max_length=500)
    is_published: bool = False


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    summary: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    tags: Optional[str] = Field(None, max_length=500)
    is_published: Optional[bool] = None


class AuthorSummary(BaseModel):
    id: int
    username: str
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class BlogPostResponse(BaseModel):
    id: int
    title: str
    slug: str
    content: str
    summary: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: Optional[str] = None
    is_published: bool
    published_at: Optional[datetime] = None
    views: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: AuthorSummary

    class Config:
        from_attributes = True


class BlogPostListItem(BaseModel):
    id: int
    title: str
    slug: str
    summary: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: Optional[str] = None
    is_published: bool
    published_at: Optional[datetime] = None
    views: int
    created_at: datetime
    author: AuthorSummary

    class Config:
        from_attributes = True


class BlogPostListResponse(BaseModel):
    items: List[BlogPostListItem]
    total: int
    page: int
    page_size: int
