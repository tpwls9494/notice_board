from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == normalize_email(email)).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=normalize_email(str(user.email)),
        username=user.username,
        hashed_password=hashed_password,
        has_local_password=True,
        email_verified=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, normalize_email(email))
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def update_username(db: Session, user: User, username: str) -> User:
    user.username = username
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_password(db: Session, user: User, new_password: str) -> User:
    user.hashed_password = get_password_hash(new_password)
    user.has_local_password = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_profile_image_url(db: Session, user: User, profile_image_url: str) -> User:
    user.profile_image_url = profile_image_url
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def mark_email_verified(db: Session, user: User) -> User:
    now = datetime.now(timezone.utc)
    user.email_verified = True
    user.email_verified_at = now
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
