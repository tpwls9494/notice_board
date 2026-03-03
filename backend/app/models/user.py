from sqlalchemy import Boolean, Column, Integer, String, DateTime, false, true
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    has_local_password = Column(Boolean, nullable=False, default=True, server_default=true())
    email_verified = Column(Boolean, nullable=False, default=False, server_default=false())
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Engagement features
    profile_image_url = Column(String(500), nullable=True)
    bio = Column(String(200), nullable=True)
    experience_points = Column(Integer, default=0)
    level = Column(Integer, default=1)
    badge = Column(String(50), default="초보자")

    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    following_links = relationship(
        "UserFollow",
        foreign_keys="UserFollow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
    )
    follower_links = relationship(
        "UserFollow",
        foreign_keys="UserFollow.following_id",
        back_populates="following",
        cascade="all, delete-orphan",
    )
    blocking_links = relationship(
        "UserBlock",
        foreign_keys="UserBlock.blocker_id",
        back_populates="blocker",
        cascade="all, delete-orphan",
    )
    blocked_by_links = relationship(
        "UserBlock",
        foreign_keys="UserBlock.blocked_id",
        back_populates="blocked",
        cascade="all, delete-orphan",
    )
    recruit_applications = relationship(
        "RecruitApplication",
        back_populates="applicant",
        cascade="all, delete-orphan",
    )
    email_verification_tokens = relationship(
        "EmailVerificationToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
