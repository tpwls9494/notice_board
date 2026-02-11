from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.mcp_review import McpReview
from app.schemas.mcp_review import McpReviewCreate, McpReviewUpdate
from app.crud.mcp_server import update_avg_rating


def get_reviews_by_server(
    db: Session, server_id: int, skip: int = 0, limit: int = 10
) -> Tuple[List[McpReview], int]:
    query = db.query(McpReview).filter(McpReview.server_id == server_id)
    total = query.count()
    reviews = query.order_by(desc(McpReview.created_at)).offset(skip).limit(limit).all()
    return reviews, total


def get_review(db: Session, review_id: int) -> Optional[McpReview]:
    return db.query(McpReview).filter(McpReview.id == review_id).first()


def get_user_review_for_server(db: Session, server_id: int, user_id: int) -> Optional[McpReview]:
    return (
        db.query(McpReview)
        .filter(McpReview.server_id == server_id, McpReview.user_id == user_id)
        .first()
    )


def create_review(db: Session, review: McpReviewCreate, user_id: int) -> McpReview:
    db_review = McpReview(
        rating=review.rating,
        content=review.content,
        server_id=review.server_id,
        user_id=user_id,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    update_avg_rating(db, review.server_id)
    return db_review


def update_review(db: Session, review_id: int, review_update: McpReviewUpdate) -> Optional[McpReview]:
    db_review = get_review(db, review_id)
    if not db_review:
        return None

    update_data = review_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_review, key, value)

    db.commit()
    db.refresh(db_review)
    update_avg_rating(db, db_review.server_id)
    return db_review


def delete_review(db: Session, review_id: int) -> bool:
    db_review = get_review(db, review_id)
    if not db_review:
        return False
    server_id = db_review.server_id
    db.delete(db_review)
    db.commit()
    update_avg_rating(db, server_id)
    return True
