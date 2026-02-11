from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.schemas.mcp_review import McpReviewCreate, McpReviewUpdate, McpReviewResponse
from app.crud import mcp_review as crud_mcp_review
from app.crud import mcp_server as crud_mcp_server
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/server/{server_id}")
def get_reviews(
    server_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    skip = (page - 1) * page_size
    reviews, total = crud_mcp_review.get_reviews_by_server(db, server_id, skip=skip, limit=page_size)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "reviews": [
            McpReviewResponse(
                id=r.id,
                rating=r.rating,
                content=r.content,
                server_id=r.server_id,
                user_id=r.user_id,
                author_username=r.author.username if r.author else None,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in reviews
        ],
    }


@router.post("/", response_model=McpReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review: McpReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, review.server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    existing = crud_mcp_review.get_user_review_for_server(db, review.server_id, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this server",
        )

    try:
        db_review = crud_mcp_review.create_review(db, review, current_user.id)
        return McpReviewResponse(
            id=db_review.id,
            rating=db_review.rating,
            content=db_review.content,
            server_id=db_review.server_id,
            user_id=db_review.user_id,
            author_username=current_user.username,
            created_at=db_review.created_at,
            updated_at=db_review.updated_at,
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this server",
        )


@router.put("/{review_id}", response_model=McpReviewResponse)
def update_review(
    review_id: int,
    review_update: McpReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_review = crud_mcp_review.get_review(db, review_id)
    if not db_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    if db_review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    updated = crud_mcp_review.update_review(db, review_id, review_update)
    return McpReviewResponse(
        id=updated.id,
        rating=updated.rating,
        content=updated.content,
        server_id=updated.server_id,
        user_id=updated.user_id,
        author_username=updated.author.username if updated.author else None,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_review = crud_mcp_review.get_review(db, review_id)
    if not db_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    if db_review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    crud_mcp_review.delete_review(db, review_id)
    return None
