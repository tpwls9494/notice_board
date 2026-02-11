from datetime import datetime
from pydantic import BaseModel, Field


class McpToolBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    input_schema: str | None = None
    sample_output: str | None = None


class McpToolCreate(McpToolBase):
    pass


class McpToolResponse(McpToolBase):
    id: int

    class Config:
        from_attributes = True


class McpInstallGuideBase(BaseModel):
    client_name: str = Field(..., min_length=1, max_length=50)
    config_json: str = Field(..., min_length=1)
    instructions: str | None = None


class McpInstallGuideCreate(McpInstallGuideBase):
    pass


class McpInstallGuideResponse(McpInstallGuideBase):
    id: int

    class Config:
        from_attributes = True


class McpServerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    short_description: str | None = Field(None, max_length=300)
    github_url: str | None = Field(None, max_length=500)
    install_command: str | None = None
    package_name: str | None = Field(None, max_length=200)
    category_id: int | None = None
    demo_video_url: str | None = Field(None, max_length=500)
    showcase_data: str | None = None


class McpServerCreate(McpServerBase):
    is_featured: bool = False
    is_verified: bool = False
    tools: list[dict] | None = None
    install_guides: list[dict] | None = None


class McpServerUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, min_length=1)
    short_description: str | None = Field(None, max_length=300)
    github_url: str | None = Field(None, max_length=500)
    install_command: str | None = None
    package_name: str | None = Field(None, max_length=200)
    category_id: int | None = None
    is_featured: bool | None = None
    is_verified: bool | None = None
    demo_video_url: str | None = Field(None, max_length=500)
    showcase_data: str | None = None


class McpServerResponse(McpServerBase):
    id: int
    slug: str
    github_stars: int
    github_readme: str | None = None
    is_featured: bool
    is_verified: bool
    avg_rating: float
    review_count: int
    created_by: int | None = None
    creator_username: str | None = None
    category_name: str | None = None
    created_at: datetime
    updated_at: datetime
    tools: list[McpToolResponse] = []
    install_guides: list[McpInstallGuideResponse] = []

    class Config:
        from_attributes = True


class McpServerListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    servers: list[McpServerResponse]
