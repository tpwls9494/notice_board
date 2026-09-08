from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, HttpUrl, StringConstraints, field_validator


SignalKind = Literal["release", "workflow", "research"]
SignalStatus = Literal["candidate", "review", "published", "rejected", "archived"]
VerificationLevel = Literal["official", "cross_checked", "community", "unverified"]
CommentKind = Literal["question", "experience", "tip", "correction"]


class SignalCreate(BaseModel):
    title: str = Field(..., min_length=4, max_length=255)
    summary: str = Field(..., min_length=10, max_length=3000)
    body: Optional[str] = Field(None, max_length=20000)
    original_title: Optional[str] = Field(None, max_length=500)
    image_url: Optional[HttpUrl] = None
    why_it_matters: Optional[str] = Field(None, max_length=3000)
    try_this: Optional[str] = Field(None, max_length=3000)
    content_kind: SignalKind
    source_kind: str = Field(..., min_length=2, max_length=30)
    source_name: str = Field(..., min_length=2, max_length=120)
    source_url: HttpUrl
    source_published_at: Optional[datetime] = None
    evidence: list[HttpUrl] = Field(default_factory=list, max_length=8)
    tags: list[str] = Field(default_factory=list, max_length=12)
    confidence_score: float = Field(0.0, ge=0, le=1)
    novelty_score: float = Field(0.0, ge=0, le=1)
    usefulness_score: float = Field(0.0, ge=0, le=1)
    importance_score: float = Field(0.0, ge=0, le=1)
    external_reactions: int = Field(0, ge=0)
    verification_level: VerificationLevel = "unverified"
    status: SignalStatus = "candidate"
    is_featured: bool = False
    pinned_until: Optional[datetime] = None

    @field_validator("source_url")
    @classmethod
    def reject_source_credentials(cls, value: HttpUrl) -> HttpUrl:
        if value.username or value.password:
            raise ValueError("출처 URL에는 사용자 정보나 비밀번호를 포함할 수 없습니다.")
        return value


class SignalAdminUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=4, max_length=255)
    summary: Optional[str] = Field(None, min_length=10, max_length=3000)
    body: Optional[str] = Field(None, max_length=20000)
    original_title: Optional[str] = Field(None, max_length=500)
    image_url: Optional[HttpUrl] = None
    why_it_matters: Optional[str] = Field(None, max_length=3000)
    try_this: Optional[str] = Field(None, max_length=3000)
    content_kind: Optional[SignalKind] = None
    source_kind: Optional[str] = Field(None, min_length=2, max_length=30)
    source_name: Optional[str] = Field(None, min_length=2, max_length=120)
    source_url: Optional[HttpUrl] = None
    source_published_at: Optional[datetime] = None
    evidence: Optional[list[HttpUrl]] = Field(None, max_length=8)
    tags: Optional[list[str]] = Field(None, max_length=12)
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    novelty_score: Optional[float] = Field(None, ge=0, le=1)
    usefulness_score: Optional[float] = Field(None, ge=0, le=1)
    importance_score: Optional[float] = Field(None, ge=0, le=1)
    external_reactions: Optional[int] = Field(None, ge=0)
    verification_level: Optional[VerificationLevel] = None
    is_featured: Optional[bool] = None
    pinned_until: Optional[datetime] = None

    @field_validator("source_url")
    @classmethod
    def reject_source_credentials(cls, value: Optional[HttpUrl]) -> Optional[HttpUrl]:
        if value is not None and (value.username or value.password):
            raise ValueError("출처 URL에는 사용자 정보나 비밀번호를 포함할 수 없습니다.")
        return value

    @field_validator("title", "summary", "body", "why_it_matters", "try_this", "source_kind", "source_name")
    @classmethod
    def strip_text_fields(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None


class SignalReviewUpdate(BaseModel):
    action: Literal["publish", "hold", "reject", "archive"]
    note: Optional[str] = Field(None, max_length=2000)
    verification_level: Optional[VerificationLevel] = None


class SignalResponse(BaseModel):
    id: int
    slug: str
    title: str
    summary: str
    body: Optional[str] = None
    original_title: Optional[str] = None
    image_url: Optional[str] = None
    why_it_matters: Optional[str] = None
    try_this: Optional[str] = None
    content_kind: SignalKind
    status: SignalStatus
    verification_level: VerificationLevel
    source_kind: str
    source_name: str
    source_url: str
    source_published_at: Optional[datetime] = None
    evidence: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    confidence_score: float
    novelty_score: float
    usefulness_score: float
    importance_score: float
    external_reactions: int
    recommendation_count: int = 0
    ranking_recommendations: int = 0
    ranking_commenters: int = 0
    ranking_participants: int = 0
    ranking_score: int = 0
    is_recommended: bool = False
    is_featured: bool
    views: int
    comment_count: int = 0
    published_at: Optional[datetime] = None
    pinned_until: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SignalListResponse(BaseModel):
    items: list[SignalResponse]
    total: int
    page: int
    page_size: int


class SignalCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    parent_id: Optional[int] = Field(None, gt=0)
    # Retained for old clients/records only; the UI no longer categorizes comments.
    kind: CommentKind = "question"

    @field_validator("content")
    @classmethod
    def strip_comment(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return normalized


class SignalCommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def strip_comment(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return value


class SignalCommentResponse(BaseModel):
    id: int
    signal_id: int
    user_id: Optional[int]
    parent_id: Optional[int] = None
    author_username: str
    author_profile_image_url: Optional[str] = None
    kind: CommentKind
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_deleted: bool = False
    is_hidden: bool = False


InterestKeyword = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class InterestUpdate(BaseModel):
    keywords: list[InterestKeyword] = Field(default_factory=list, max_length=20)


class InterestResponse(BaseModel):
    keywords: list[str]


class SignalCommentModeration(BaseModel):
    hidden: bool = True
