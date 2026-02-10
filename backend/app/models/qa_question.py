from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class QAQuestion(Base):
    __tablename__ = "qa_questions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    bounty = Column(Integer, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_solved = Column(Boolean, default=False)
    accepted_answer_id = Column(Integer, ForeignKey("qa_answers.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    author = relationship("User", foreign_keys=[user_id])
    answers = relationship(
        "QAAnswer",
        back_populates="question",
        foreign_keys="QAAnswer.question_id",
        cascade="all, delete-orphan",
    )
    accepted_answer = relationship("QAAnswer", foreign_keys=[accepted_answer_id], post_update=True)
