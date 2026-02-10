from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.qa import (
    QAQuestionCreate, QAQuestionResponse, QAQuestionDetailResponse,
    QAQuestionListResponse, QAAnswerCreate, QAAnswerResponse,
    PointTransactionResponse,
)
from app.models.user import User
from app.crud import qa as crud_qa

router = APIRouter()


@router.get("/questions/", response_model=QAQuestionListResponse)
def get_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * page_size
    questions, total = crud_qa.get_questions(db, skip=skip, limit=page_size, search=search)

    question_responses = []
    for q in questions:
        question_responses.append(
            QAQuestionResponse(
                id=q.id,
                title=q.title,
                content=q.content,
                bounty=q.bounty,
                user_id=q.user_id,
                is_solved=q.is_solved,
                accepted_answer_id=q.accepted_answer_id,
                created_at=q.created_at,
                updated_at=q.updated_at,
                author_username=q.author.username if q.author else None,
                answer_count=crud_qa.get_answer_count(db, q.id),
            )
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "questions": question_responses,
    }


@router.get("/questions/{question_id}", response_model=QAQuestionDetailResponse)
def get_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = crud_qa.get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    answers = [
        QAAnswerResponse(
            id=a.id,
            content=a.content,
            question_id=a.question_id,
            user_id=a.user_id,
            is_accepted=a.is_accepted,
            created_at=a.created_at,
            author_username=a.author.username if a.author else None,
        )
        for a in question.answers
    ]

    return QAQuestionDetailResponse(
        id=question.id,
        title=question.title,
        content=question.content,
        bounty=question.bounty,
        user_id=question.user_id,
        is_solved=question.is_solved,
        accepted_answer_id=question.accepted_answer_id,
        created_at=question.created_at,
        updated_at=question.updated_at,
        author_username=question.author.username if question.author else None,
        answer_count=len(answers),
        answers=answers,
    )


@router.post("/questions/", response_model=QAQuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
    question: QAQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        db_question = crud_qa.create_question(db, question, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return QAQuestionResponse(
        id=db_question.id,
        title=db_question.title,
        content=db_question.content,
        bounty=db_question.bounty,
        user_id=db_question.user_id,
        is_solved=db_question.is_solved,
        accepted_answer_id=db_question.accepted_answer_id,
        created_at=db_question.created_at,
        updated_at=db_question.updated_at,
        author_username=current_user.username,
        answer_count=0,
    )


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = crud_qa.get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if question.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    try:
        crud_qa.delete_question(db, question_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return None


@router.post("/answers/", response_model=QAAnswerResponse, status_code=status.HTTP_201_CREATED)
def create_answer(
    answer: QAAnswerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        db_answer = crud_qa.create_answer(db, answer, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return QAAnswerResponse(
        id=db_answer.id,
        content=db_answer.content,
        question_id=db_answer.question_id,
        user_id=db_answer.user_id,
        is_accepted=db_answer.is_accepted,
        created_at=db_answer.created_at,
        author_username=current_user.username,
    )


@router.delete("/answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_answer(
    answer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer = crud_qa.get_answer(db, answer_id)
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
    if answer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    try:
        crud_qa.delete_answer(db, answer_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return None


@router.post("/questions/{question_id}/accept/{answer_id}", response_model=QAQuestionResponse)
def accept_answer(
    question_id: int,
    answer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        question = crud_qa.accept_answer(db, question_id, answer_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return QAQuestionResponse(
        id=question.id,
        title=question.title,
        content=question.content,
        bounty=question.bounty,
        user_id=question.user_id,
        is_solved=question.is_solved,
        accepted_answer_id=question.accepted_answer_id,
        created_at=question.created_at,
        updated_at=question.updated_at,
        author_username=question.author.username if question.author else None,
        answer_count=crud_qa.get_answer_count(db, question.id),
    )


@router.get("/points/me")
def get_my_points(
    current_user: User = Depends(get_current_user),
):
    return {"points": current_user.points}


@router.get("/points/history", response_model=List[PointTransactionResponse])
def get_point_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transactions = crud_qa.get_user_point_transactions(db, current_user.id)
    return transactions
