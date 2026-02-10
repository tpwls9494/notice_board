from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class QAQuestionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    bounty: int = Field(..., ge=10)


class QAQuestionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)


class QAAnswerCreate(BaseModel):
    content: str = Field(..., min_length=1)
    question_id: int


class QAAnswerResponse(BaseModel):
    id: int
    content: str
    question_id: int
    user_id: int
    is_accepted: bool
    created_at: datetime
    author_username: Optional[str] = None

    class Config:
        from_attributes = True


class QAQuestionResponse(BaseModel):
    id: int
    title: str
    content: str
    bounty: int
    user_id: int
    is_solved: bool
    accepted_answer_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    author_username: Optional[str] = None
    answer_count: Optional[int] = 0

    class Config:
        from_attributes = True


class QAQuestionDetailResponse(QAQuestionResponse):
    answers: List[QAAnswerResponse] = []


class QAQuestionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    questions: List[QAQuestionResponse]


class PointTransactionResponse(BaseModel):
    id: int
    amount: int
    balance_after: int
    description: str
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
