from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_, case
from app.models.qa_question import QAQuestion
from app.models.qa_answer import QAAnswer
from app.models.user import User
from app.models.point_transaction import PointTransaction
from app.schemas.qa import QAQuestionCreate, QAAnswerCreate


def get_questions(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
) -> tuple[List[QAQuestion], int]:
    query = db.query(QAQuestion)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                QAQuestion.title.ilike(search_filter),
                QAQuestion.content.ilike(search_filter),
            )
        )

    total = query.count()

    # Unsolved first, then by created_at DESC
    unsolved_sort = case(
        (QAQuestion.is_solved == False, 0),
        else_=1,
    )
    questions = (
        query.order_by(unsolved_sort, desc(QAQuestion.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return questions, total


def get_question(db: Session, question_id: int) -> Optional[QAQuestion]:
    return (
        db.query(QAQuestion)
        .options(joinedload(QAQuestion.answers))
        .filter(QAQuestion.id == question_id)
        .first()
    )


def get_answer_count(db: Session, question_id: int) -> int:
    return (
        db.query(func.count(QAAnswer.id))
        .filter(QAAnswer.question_id == question_id)
        .scalar()
    )


def create_question(
    db: Session, question: QAQuestionCreate, user_id: int
) -> QAQuestion:
    # Lock user row to prevent race conditions
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise ValueError("User not found")

    if user.points < question.bounty:
        raise ValueError("포인트가 부족합니다")

    # Deduct points
    user.points -= question.bounty

    db_question = QAQuestion(
        title=question.title,
        content=question.content,
        bounty=question.bounty,
        user_id=user_id,
    )
    db.add(db_question)
    db.flush()  # get the question id

    # Record transaction
    tx = PointTransaction(
        user_id=user_id,
        amount=-question.bounty,
        balance_after=user.points,
        description=f"질문 #{db_question.id} 등록 (포인트 차감)",
        reference_type="qa_question",
        reference_id=db_question.id,
    )
    db.add(tx)
    db.commit()
    db.refresh(db_question)
    return db_question


def create_answer(
    db: Session, answer: QAAnswerCreate, user_id: int
) -> QAAnswer:
    question = get_question(db, answer.question_id)
    if not question:
        raise ValueError("질문을 찾을 수 없습니다")

    if question.is_solved:
        raise ValueError("이미 해결된 질문입니다")

    if question.user_id == user_id:
        raise ValueError("본인 질문에는 답변할 수 없습니다")

    db_answer = QAAnswer(
        content=answer.content,
        question_id=answer.question_id,
        user_id=user_id,
    )
    db.add(db_answer)
    db.commit()
    db.refresh(db_answer)
    return db_answer


def get_answer(db: Session, answer_id: int) -> Optional[QAAnswer]:
    return db.query(QAAnswer).filter(QAAnswer.id == answer_id).first()


def accept_answer(
    db: Session, question_id: int, answer_id: int, user_id: int
) -> QAQuestion:
    question = db.query(QAQuestion).filter(QAQuestion.id == question_id).first()
    if not question:
        raise ValueError("질문을 찾을 수 없습니다")

    if question.user_id != user_id:
        raise ValueError("질문 작성자만 답변을 채택할 수 있습니다")

    if question.is_solved:
        raise ValueError("이미 해결된 질문입니다")

    answer = db.query(QAAnswer).filter(QAAnswer.id == answer_id).first()
    if not answer or answer.question_id != question_id:
        raise ValueError("해당 답변을 찾을 수 없습니다")

    # Credit answerer (lock row)
    answerer = (
        db.query(User).filter(User.id == answer.user_id).with_for_update().first()
    )
    answerer.points += question.bounty

    # Record credit transaction
    tx = PointTransaction(
        user_id=answer.user_id,
        amount=question.bounty,
        balance_after=answerer.points,
        description=f"질문 #{question.id} 답변 채택 보상",
        reference_type="qa_answer_accepted",
        reference_id=answer.id,
    )
    db.add(tx)

    # Mark as solved
    question.is_solved = True
    question.accepted_answer_id = answer_id
    answer.is_accepted = True

    db.commit()
    db.refresh(question)
    return question


def delete_question(db: Session, question_id: int, user_id: int) -> bool:
    question = db.query(QAQuestion).filter(QAQuestion.id == question_id).first()
    if not question:
        return False

    if question.is_solved:
        raise ValueError("해결된 질문은 삭제할 수 없습니다")

    # Refund bounty
    user = db.query(User).filter(User.id == question.user_id).with_for_update().first()
    user.points += question.bounty

    tx = PointTransaction(
        user_id=question.user_id,
        amount=question.bounty,
        balance_after=user.points,
        description=f"질문 #{question.id} 삭제 (포인트 환불)",
        reference_type="qa_question",
        reference_id=question.id,
    )
    db.add(tx)

    db.delete(question)
    db.commit()
    return True


def delete_answer(db: Session, answer_id: int) -> bool:
    answer = get_answer(db, answer_id)
    if not answer:
        return False

    if answer.is_accepted:
        raise ValueError("채택된 답변은 삭제할 수 없습니다")

    db.delete(answer)
    db.commit()
    return True


def get_user_point_transactions(
    db: Session, user_id: int, skip: int = 0, limit: int = 20
) -> List[PointTransaction]:
    return (
        db.query(PointTransaction)
        .filter(PointTransaction.user_id == user_id)
        .order_by(desc(PointTransaction.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
