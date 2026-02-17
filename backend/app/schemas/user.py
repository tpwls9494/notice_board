from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    # 로그인은 기존 운영 계정 호환을 위해 .local 도메인 등도 허용합니다.
    email: str = Field(..., min_length=3, max_length=255)
    password: str


class UserResponse(UserBase):
    id: int
    is_admin: bool
    created_at: datetime
    profile_image_url: Optional[str] = None
    bio: Optional[str] = None
    experience_points: int = 0
    level: int = 1
    badge: str = "초보자"

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    bio: Optional[str] = Field(None, max_length=200)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
