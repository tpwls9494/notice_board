from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class McpReview(Base):
    __tablename__ = "mcp_reviews"

    id = Column(Integer, primary_key=True, index=True)
    rating = Column(Integer, nullable=False)
    content = Column(Text)
    server_id = Column(Integer, ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    server = relationship("McpServer", back_populates="reviews")
    author = relationship("User")

    __table_args__ = (
        UniqueConstraint("server_id", "user_id", name="unique_server_user_review"),
    )
