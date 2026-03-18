from pydantic import BaseModel, Field


class BlogCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class BlogCategoryResponse(BaseModel):
    id: int
    name: str
    order: int = 0

    class Config:
        from_attributes = True
