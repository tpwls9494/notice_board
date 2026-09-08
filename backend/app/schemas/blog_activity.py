from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class BlogActivity(BaseModel):
    post_id: int
    views: int
    like_count: int
    comment_count: int
    liked: bool = False


class BlogCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    parent_id: int | None = Field(default=None, gt=0)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return value


class BlogCommentUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return value


class CommentAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str


class BlogCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    content: str
    created_at: datetime
    author: CommentAuthor
    parent_id: int | None = None
    is_deleted: bool = False
    updated_at: datetime | None = None


class BlogCommentsResponse(BaseModel):
    items: list[BlogCommentResponse]
    total: int
    thread_total: int
    page: int
    page_size: int
