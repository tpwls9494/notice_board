from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


POST_TYPE_NORMAL = "NORMAL"
POST_TYPE_RECRUIT = "RECRUIT"
RECRUIT_STATUS_OPEN = "OPEN"
RECRUIT_STATUS_CLOSED = "CLOSED"
RECRUIT_APPLICATION_STATUS_PENDING = "PENDING"
RECRUIT_APPLICATION_STATUS_ACCEPTED = "ACCEPTED"
RECRUIT_APPLICATION_STATUS_REJECTED = "REJECTED"


class RecruitMetaBase(BaseModel):
    recruit_type: str = Field(..., min_length=1, max_length=30)
    status: Literal["OPEN", "CLOSED"] = RECRUIT_STATUS_OPEN
    is_online: bool = True
    location_text: Optional[str] = Field(None, max_length=255)
    schedule_text: str = Field(..., min_length=1, max_length=255)
    headcount_max: int = Field(..., ge=1, le=10_000)
    deadline_at: datetime

    @field_validator("recruit_type")
    @classmethod
    def normalize_recruit_type(cls, value: str) -> str:
        return value.strip().upper()


class RecruitMetaCreate(RecruitMetaBase):
    pass


class RecruitMetaUpdate(BaseModel):
    recruit_type: Optional[str] = Field(None, min_length=1, max_length=30)
    status: Optional[Literal["OPEN", "CLOSED"]] = None
    is_online: Optional[bool] = None
    location_text: Optional[str] = Field(None, max_length=255)
    schedule_text: Optional[str] = Field(None, min_length=1, max_length=255)
    headcount_max: Optional[int] = Field(None, ge=1, le=10_000)
    deadline_at: Optional[datetime] = None

    @field_validator("recruit_type")
    @classmethod
    def normalize_recruit_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().upper()


class RecruitMetaResponse(RecruitMetaBase):
    class Config:
        from_attributes = True


class PostBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category_id: int
    post_type: Literal["NORMAL", "RECRUIT"] = POST_TYPE_NORMAL

    @field_validator("post_type")
    @classmethod
    def normalize_post_type(cls, value: str) -> str:
        return value.strip().upper()


class PostCreate(PostBase):
    recruit_meta: Optional[RecruitMetaCreate] = None

    @model_validator(mode="after")
    def validate_recruit_payload(self):
        if self.post_type == POST_TYPE_RECRUIT and self.recruit_meta is None:
            raise ValueError("Recruit posts require recruit_meta")
        if self.post_type == POST_TYPE_NORMAL and self.recruit_meta is not None:
            raise ValueError("Normal posts cannot include recruit_meta")
        return self


class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    category_id: Optional[int] = None
    post_type: Optional[Literal["NORMAL", "RECRUIT"]] = None
    recruit_meta: Optional[RecruitMetaUpdate] = None

    @field_validator("post_type")
    @classmethod
    def normalize_post_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().upper()


class PostResponse(PostBase):
    id: int
    views: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    author_username: Optional[str] = None
    author_profile_image_url: Optional[str] = None
    comment_count: Optional[int] = 0
    likes_count: Optional[int] = 0
    is_liked: Optional[bool] = False
    is_bookmarked: Optional[bool] = False
    is_pinned: Optional[bool] = False
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    recruit_meta: Optional[RecruitMetaResponse] = None

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    posts: List[PostResponse]


class RecruitApplicationCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2_000)
    link: Optional[str] = Field(None, max_length=500)


class RecruitApplicationStatusUpdate(BaseModel):
    status: Literal["ACCEPTED", "REJECTED"]


class RecruitApplicationResponse(BaseModel):
    id: int
    recruit_post_id: int
    applicant_id: int
    applicant_username: Optional[str] = None
    applicant_profile_image_url: Optional[str] = None
    message: str
    link: Optional[str] = None
    status: Literal["PENDING", "ACCEPTED", "REJECTED"] = RECRUIT_APPLICATION_STATUS_PENDING
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
