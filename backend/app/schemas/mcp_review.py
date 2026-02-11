from datetime import datetime
from pydantic import BaseModel, Field


class McpReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: str | None = None


class McpReviewCreate(McpReviewBase):
    server_id: int


class McpReviewUpdate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    content: str | None = None


class McpReviewResponse(McpReviewBase):
    id: int
    server_id: int
    user_id: int
    author_username: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
