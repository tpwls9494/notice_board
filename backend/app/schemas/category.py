from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = Field(None, max_length=200)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = Field(None, max_length=200)


class CategoryResponse(CategoryBase):
    id: int
    slug: str
    icon: str | None = None
    order: int = 0
    is_active: bool = True

    class Config:
        from_attributes = True
