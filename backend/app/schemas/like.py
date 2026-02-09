from datetime import datetime
from pydantic import BaseModel


class LikeCreate(BaseModel):
    post_id: int


class LikeResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
