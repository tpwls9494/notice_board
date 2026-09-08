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

    @field_validator("title", "content")
    @classmethod
    def require_text(cls, value: str, info):
        if not value.strip():
            raise ValueError("제목과 본문을 입력해 주세요.")
        return value.strip() if info.field_name == "title" else value


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    summary: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    tags: Optional[str] = Field(None, max_length=500)
    is_published: Optional[bool] = None

    @field_validator("title", "content", "is_published")
    @classmethod
    def reject_empty_required_fields(cls, value, info):
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValueError("필수 항목은 비워둘 수 없습니다.")
        return value.strip() if info.field_name == "title" else value


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
    updated_at: Optional[datetime] = None
    author: AuthorSummary

    class Config:
        from_attributes = True


class BlogPostListResponse(BaseModel):
    items: List[BlogPostListItem]
    total: int
    page: int
    page_size: int


class BlogPostCounts(BaseModel):
    total: int
    published: int
    draft: int


class BlogPostAdminListResponse(BlogPostListResponse):
    counts: BlogPostCounts
