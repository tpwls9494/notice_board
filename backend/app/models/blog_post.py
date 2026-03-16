from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship
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
