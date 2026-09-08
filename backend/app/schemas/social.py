from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


SocialSpace = Literal["community", "lounge"]
SocialTopic = Literal["story", "question", "experience", "tip", "chat"]


class SiteActivityResponse(BaseModel):
    date: date
    week_start: date
    today_signals: int = Field(ge=0)
    week_experiences: int = Field(ge=0)
    updated_at: datetime


class CommunityImageResponse(BaseModel):
    url: str
    width: int
    height: int
    size: int


class SocialPostCreate(BaseModel):
    related_signal_id: Optional[int] = Field(None, gt=0)
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=1, max_length=20_000)
    space: SocialSpace = "community"
    topic: SocialTopic = "story"
    tags: list[str] = Field(default_factory=list, max_length=8)
    image_url: Optional[HttpUrl] = None

    @field_validator("title", "content")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("내용을 입력해 주세요.")
        return value


class SocialPostUpdate(BaseModel):
    related_signal_id: Optional[int] = Field(None, gt=0)
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=20_000)
    space: Optional[SocialSpace] = None
    topic: Optional[SocialTopic] = None
    tags: Optional[list[str]] = Field(None, max_length=8)
    image_url: Optional[HttpUrl] = None

    @field_validator("title", "content")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("내용을 입력해 주세요.")
        return value


class RelatedSignalResponse(BaseModel):
    id: int
    slug: str
    title: str


class SocialPostResponse(BaseModel):
    related_signal: Optional[RelatedSignalResponse] = None
    id: int
    user_id: int
    author_username: str
    author_profile_image_url: Optional[str] = None
    title: str
    content: str
    space: SocialSpace
    topic: SocialTopic
    tags: list[str]
    image_url: Optional[str] = None
    views: int
    recommendation_count: int
    comment_count: int
    is_recommended: bool = False
    created_at: datetime
    updated_at: datetime


class SocialPostListResponse(BaseModel):
    items: list[SocialPostResponse]
    total: int
    page: int
    page_size: int


class SocialCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5_000)
    parent_id: Optional[int] = None

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return value


class SocialCommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5_000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return value


class SocialCommentResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    parent_id: Optional[int] = None
    author_username: str
    author_profile_image_url: Optional[str] = None
    content: str
    is_deleted: bool
    recommendation_count: int
    is_recommended: bool = False
    created_at: datetime
    updated_at: datetime
