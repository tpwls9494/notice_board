from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user_optional
from app.schemas.community import CommunityStatsResponse
from app.schemas.post import PostResponse
from app.crud import community as crud_community
from app.crud import post as crud_post
from app.models.user import User

router = APIRouter()


@router.get("/stats", response_model=CommunityStatsResponse)
def get_community_stats(
    db: Session = Depends(get_db),
):
    return crud_community.get_community_stats(db)


@router.get("/pinned", response_model=list[PostResponse])
def get_pinned_posts(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    posts = crud_community.get_pinned_posts(db, limit=limit)
    return [
        PostResponse(
            id=p.id,
            title=p.title,
            content=p.content,
            views=p.views,
            user_id=p.user_id,
            category_id=p.category_id,
            created_at=p.created_at,
            updated_at=p.updated_at,
            author_username=p.author.username if p.author else None,
            author_profile_image_url=p.author.profile_image_url if p.author else None,
            comment_count=crud_post.get_comment_count(db, p.id),
            likes_count=crud_post.get_likes_count(db, p.id),
            is_liked=crud_post.check_user_liked(db, p.id, current_user.id) if current_user else False,
            is_bookmarked=crud_post.check_user_bookmarked(db, p.id, current_user.id) if current_user else False,
            is_pinned=p.is_pinned or False,
            category_name=p.category.name if p.category else None,
        )
        for p in posts
    ]


@router.get("/hot", response_model=list[PostResponse])
def get_hot_posts(
    window: str = Query("24h", pattern="^(24h|7d|30d)$"),
    limit: int = Query(6, ge=1, le=20),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    results = crud_community.get_hot_posts(
        db, window=window, limit=limit, category_id=category_id
    )
    return [
        PostResponse(
            id=r["post"].id,
            title=r["post"].title,
            content=r["post"].content,
            views=r["post"].views,
            user_id=r["post"].user_id,
            category_id=r["post"].category_id,
            created_at=r["post"].created_at,
            updated_at=r["post"].updated_at,
            author_username=r["post"].author.username if r["post"].author else None,
            author_profile_image_url=r["post"].author.profile_image_url if r["post"].author else None,
            comment_count=r["comment_count"],
            likes_count=r["likes_count"],
            is_liked=crud_post.check_user_liked(db, r["post"].id, current_user.id) if current_user else False,
            is_bookmarked=crud_post.check_user_bookmarked(db, r["post"].id, current_user.id) if current_user else False,
            is_pinned=r["post"].is_pinned or False,
            category_name=r["post"].category.name if r["post"].category else None,
        )
        for r in results
    ]
