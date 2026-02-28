import logging
from datetime import timedelta
import mimetypes
import os
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserNicknameUpdate,
    UserPasswordUpdate,
    Token,
)
from app.core.security import create_access_token, verify_password
from app.core.config import settings
from app.crud import user as crud_user
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

PROFILE_IMAGE_DIR = "/app/uploads/profile_images"
PROFILE_IMAGE_URL_PREFIX = "/api/v1/auth/profile-images"
MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_PROFILE_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}
MIME_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
os.makedirs(PROFILE_IMAGE_DIR, exist_ok=True)


def _remove_old_profile_image(profile_image_url: str | None) -> None:
    if not profile_image_url:
        return

    url_prefix = f"{PROFILE_IMAGE_URL_PREFIX}/"
    if not profile_image_url.startswith(url_prefix):
        return

    filename = profile_image_url[len(url_prefix):]
    if not SAFE_FILENAME_PATTERN.match(filename):
        return

    file_path = os.path.join(PROFILE_IMAGE_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            # 파일 삭제 실패는 요청 자체를 실패시키지 않습니다.
            pass


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    if crud_user.get_user_by_email(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    if crud_user.get_user_by_username(db, user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create user
    db_user = crud_user.create_user(db, user)
    return db_user


@router.post("/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = crud_user.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/profile", response_model=UserResponse)
def update_me_profile(
    profile: UserNicknameUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_username = profile.username.strip()

    if len(new_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long",
        )

    existing_user = crud_user.get_user_by_username(db, new_username)
    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    updated_user = crud_user.update_username(db, current_user, new_username)
    return updated_user


@router.patch("/me/password")
def update_me_password(
    password_update: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(password_update.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if password_update.current_password == password_update.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    crud_user.update_password(db, current_user, password_update.new_password)
    return {"detail": "Password updated successfully"}


@router.post("/me/profile-image", response_model=UserResponse)
async def upload_me_profile_image(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_PROFILE_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, GIF, and WEBP images are allowed",
        )

    content = await file.read()
    file_size = len(content)
    if file_size > MAX_PROFILE_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be 5MB or smaller",
        )

    original_extension = os.path.splitext(file.filename or "")[1].lower()
    file_extension = (
        original_extension
        if original_extension in {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        else MIME_TO_EXTENSION[file.content_type]
    )

    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(PROFILE_IMAGE_DIR, unique_filename)

    try:
        with open(file_path, "wb") as output_file:
            output_file.write(content)
    except Exception as exc:
        logger.exception("Profile image write failed for user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save profile image",
        )

    old_profile_image_url = current_user.profile_image_url
    new_profile_image_url = f"{PROFILE_IMAGE_URL_PREFIX}/{unique_filename}"

    updated_user = crud_user.update_profile_image_url(db, current_user, new_profile_image_url)

    if old_profile_image_url and old_profile_image_url != new_profile_image_url:
        _remove_old_profile_image(old_profile_image_url)

    return updated_user


@router.get("/profile-images/{filename}")
def get_profile_image(filename: str):
    if not SAFE_FILENAME_PATTERN.match(filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )

    file_path = os.path.join(PROFILE_IMAGE_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found",
        )

    media_type, _ = mimetypes.guess_type(file_path)
    return FileResponse(path=file_path, media_type=media_type or "application/octet-stream")
