from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class RecruitApplication(Base):
    __tablename__ = "recruit_applications"

    id = Column(Integer, primary_key=True, index=True)
    recruit_post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="PENDING", server_default="PENDING", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    recruit_post = relationship("Post", back_populates="recruit_applications")
    applicant = relationship("User", back_populates="recruit_applications")

    __table_args__ = (
        UniqueConstraint("recruit_post_id", "applicant_id", name="uq_recruit_application_post_applicant"),
    )
