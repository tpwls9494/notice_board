from datetime import datetime
from pydantic import BaseModel, Field


class McpCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    slug: str = Field(..., min_length=1, max_length=50)
    description: str | None = Field(None, max_length=200)
    icon: str | None = Field(None, max_length=50)
    display_order: int = 0


class McpCategoryCreate(McpCategoryBase):
    pass


class McpCategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    slug: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = Field(None, max_length=200)
    icon: str | None = Field(None, max_length=50)
    display_order: int | None = None


class McpCategoryResponse(McpCategoryBase):
    id: int
    server_count: int | None = 0
    created_at: datetime

    class Config:
        from_attributes = True
