from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class SocialPost(Base):
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    space = Column(String(20), nullable=False, default="community", server_default="community")
    topic = Column(String(30), nullable=False, default="story", server_default="story")
    tags = Column(JSON, nullable=False, default=list)
    image_url = Column(String(1200), nullable=True)
    views = Column(Integer, nullable=False, default=0, server_default="0")
    is_hidden = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    author = relationship("User")
    comments = relationship("SocialComment", back_populates="post", cascade="all, delete-orphan")
    recommendations = relationship("SocialPostRecommendation", back_populates="post", cascade="all, delete-orphan")
    signal_link = relationship("SocialPostSignal", cascade="all, delete-orphan", uselist=False)

    __table_args__ = (
        Index("ix_social_posts_space_created", "space", "created_at"),
        Index("ix_social_posts_user_created", "user_id", "created_at"),
    )


class SocialPostSignal(Base):
    __tablename__ = "social_post_signals"

    post_id = Column(Integer, ForeignKey("social_posts.id", ondelete="CASCADE"), primary_key=True)
    signal_id = Column(Integer, ForeignKey("signals.id", ondelete="CASCADE"), nullable=False, index=True)


class SocialComment(Base):
    __tablename__ = "social_comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("social_comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    is_hidden = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    post = relationship("SocialPost", back_populates="comments")
    author = relationship("User")
    parent = relationship("SocialComment", remote_side=[id], back_populates="replies")
    replies = relationship("SocialComment", back_populates="parent", cascade="all, delete-orphan")
    recommendations = relationship("SocialCommentRecommendation", back_populates="comment", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_social_comments_post_created", "post_id", "created_at"),
        Index("ix_social_comments_parent_created", "parent_id", "created_at"),
    )


class SocialPostRecommendation(Base):
    __tablename__ = "social_post_recommendations"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    post = relationship("SocialPost", back_populates="recommendations")

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_social_post_recommendation"),
        Index("ix_social_post_recommendations_post", "post_id"),
    )


class SocialCommentRecommendation(Base):
    __tablename__ = "social_comment_recommendations"

    id = Column(Integer, primary_key=True)
    comment_id = Column(Integer, ForeignKey("social_comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    comment = relationship("SocialComment", back_populates="recommendations")

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_social_comment_recommendation"),
        Index("ix_social_comment_recommendations_comment", "comment_id"),
    )
