from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func

from app.db.base import Base


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(300), unique=True, nullable=False, index=True)
    content = Column(Text, nullable=False)
    summary = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    tags = Column(String(500), nullable=True)  # comma-separated
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    views = Column(Integer, default=0, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    author = relationship("User", backref="blog_posts")


class BlogLike(Base):
    __tablename__ = "blog_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_blog_like_user"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    post = relationship("BlogPost", backref=backref("likes", cascade="all, delete-orphan"))


class BlogComment(Base):
    __tablename__ = "blog_comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("blog_comments.id", ondelete="SET NULL"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    author = relationship("User")
    post = relationship("BlogPost", backref=backref("comments", cascade="all, delete-orphan"))


class BlogProfile(Base):
    __tablename__ = "blog_profile"

    id = Column(Integer, primary_key=True)
    image_url = Column(String(500), nullable=True)
