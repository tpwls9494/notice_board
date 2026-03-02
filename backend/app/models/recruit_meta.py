from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, true
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class RecruitMeta(Base):
    __tablename__ = "recruit_meta"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    recruit_type = Column(String(30), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="OPEN", server_default="OPEN", index=True)
    is_online = Column(Boolean, nullable=False, default=True, server_default=true(), index=True)
    location_text = Column(String(255), nullable=True)
    schedule_text = Column(String(255), nullable=False)
    headcount_max = Column(Integer, nullable=False)
    deadline_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    post = relationship("Post", back_populates="recruit_meta")
