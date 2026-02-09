import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.schemas.file import FileResponse as FileSchema
from app.crud import file as crud_file
from app.crud import post as crud_post
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

# Configure upload directory
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Max file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# Allowed file types
ALLOWED_EXTENSIONS = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain"
}


@router.post("/upload/{post_id}", response_model=FileSchema, status_code=status.HTTP_201_CREATED)
async def upload_file(
    post_id: int,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a file and attach it to a post"""
    # Check if post exists
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )

    # Check if user is the post author
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only upload files to your own posts"
        )

    # Validate file type
    if file.content_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} is not allowed"
        )

    # Read file content and check size
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / 1024 / 1024}MB"
        )

    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Save file to disk
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # Create file record in database
    db_file = crud_file.create_file(
        db=db,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        post_id=post_id,
        user_id=current_user.id
    )

    return db_file


@router.get("/post/{post_id}", response_model=List[FileSchema])
def get_post_files(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Get all files attached to a post"""
    files = crud_file.get_files_by_post(db, post_id)
    return files


@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db)
):
    """Download a file"""
    db_file = crud_file.get_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    if not os.path.exists(db_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )

    return FileResponse(
        path=db_file.file_path,
        filename=db_file.original_filename,
        media_type=db_file.mime_type
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a file"""
    db_file = crud_file.get_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    # Check if user is the uploader or post author
    post = crud_post.get_post(db, db_file.post_id)
    if db_file.uploaded_by != current_user.id and post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Delete file from disk
    try:
        if os.path.exists(db_file.file_path):
            os.remove(db_file.file_path)
    except Exception:
        pass  # Continue even if file deletion fails

    # Delete from database
    crud_file.delete_file(db, file_id)
