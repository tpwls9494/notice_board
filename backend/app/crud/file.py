from sqlalchemy.orm import Session
from app.models.file import File


def create_file(
    db: Session,
    filename: str,
    original_filename: str,
    file_path: str,
    file_size: int,
    mime_type: str,
    post_id: int,
    user_id: int
):
    """Create a file record in the database"""
    db_file = File(
        filename=filename,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        post_id=post_id,
        uploaded_by=user_id
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


def get_file(db: Session, file_id: int):
    """Get a file by ID"""
    return db.query(File).filter(File.id == file_id).first()


def get_files_by_post(db: Session, post_id: int):
    """Get all files attached to a post"""
    return db.query(File).filter(File.post_id == post_id).all()


def delete_file(db: Session, file_id: int):
    """Delete a file record from the database"""
    db_file = get_file(db, file_id)
    if db_file:
        db.delete(db_file)
        db.commit()
        return True
    return False
