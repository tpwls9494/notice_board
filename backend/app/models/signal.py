from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Signal(Base):
    """A verified, useful piece of AI information shown in the new jion feed."""

    __tablename__ = "signals"

    id = Column(Integer, primary_key=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    body = Column(Text, nullable=True)
    original_title = Column(String(500), nullable=True)
    image_url = Column(String(1200), nullable=True)
    why_it_matters = Column(Text, nullable=True)
    try_this = Column(Text, nullable=True)

    # release | workflow | research
    content_kind = Column(String(30), nullable=False)
    # candidate | review | published | rejected | archived
    status = Column(String(30), nullable=False, default="candidate", server_default="candidate")
    # official | cross_checked | community | unverified
    verification_level = Column(
        String(30), nullable=False, default="unverified", server_default="unverified"
    )

    source_kind = Column(String(30), nullable=False)
    source_name = Column(String(120), nullable=False)
    source_url = Column(String(1200), nullable=False)
    source_hash = Column(String(64), nullable=False, unique=True, index=True)
    source_published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    evidence = Column(JSON, nullable=False, default=list)
    tags = Column(JSON, nullable=False, default=list)

    confidence_score = Column(Float, nullable=False, default=0.0, server_default="0")
    novelty_score = Column(Float, nullable=False, default=0.0, server_default="0")
    usefulness_score = Column(Float, nullable=False, default=0.0, server_default="0")
    importance_score = Column(Float, nullable=False, default=0.0, server_default="0")
    external_reactions = Column(Integer, nullable=False, default=0, server_default="0")
    is_featured = Column(Boolean, nullable=False, default=False, server_default="false")
    views = Column(Integer, nullable=False, default=0, server_default="0")

    submitted_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_note = Column(Text, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    pinned_until = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    comments = relationship("SignalComment", back_populates="signal", cascade="all, delete-orphan")
    reviews = relationship("SignalReview", back_populates="signal", cascade="all, delete-orphan")
    recommendations = relationship("SignalRecommendation", back_populates="signal", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_signals_status_published_at", "status", "published_at"),
        Index("ix_signals_kind_published_at", "content_kind", "published_at"),
        Index("ix_signals_importance", "importance_score", "published_at"),
    )


class SignalComment(Base):
    __tablename__ = "signal_comments"

    id = Column(Integer, primary_key=True)
    signal_id = Column(Integer, ForeignKey("signals.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("signal_comments.id", ondelete="SET NULL"), nullable=True, index=True)
    # question | experience | tip | correction
    kind = Column(String(30), nullable=False, default="question", server_default="question")
    content = Column(Text, nullable=False)
    is_hidden = Column(Boolean, nullable=False, default=False, server_default="false")
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    signal = relationship("Signal", back_populates="comments")
    author = relationship("User")

    __table_args__ = (
        Index("ix_signal_comments_signal_visible_created", "signal_id", "is_hidden", "created_at"),
    )


class SignalReview(Base):
    __tablename__ = "signal_reviews"

    id = Column(Integer, primary_key=True)
    signal_id = Column(Integer, ForeignKey("signals.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(30), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    signal = relationship("Signal", back_populates="reviews")
    reviewer = relationship("User")

    __table_args__ = (
        Index("ix_signal_reviews_signal_created", "signal_id", "created_at"),
    )


class UserInterest(Base):
    __tablename__ = "user_interests"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    keyword = Column(String(80), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "keyword", name="uq_user_interest_keyword"),)


class SignalRecommendation(Base):
    __tablename__ = "signal_recommendations"

    id = Column(Integer, primary_key=True)
    signal_id = Column(Integer, ForeignKey("signals.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    signal = relationship("Signal", back_populates="recommendations")

    __table_args__ = (
        UniqueConstraint("signal_id", "user_id", name="uq_signal_recommendation"),
        Index("ix_signal_recommendations_signal", "signal_id"),
    )
