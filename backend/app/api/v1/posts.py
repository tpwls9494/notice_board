from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.crud import follow as crud_follow
from app.crud import notification as crud_notification
from app.crud import post as crud_post
from app.crud import recruit_application as crud_recruit_application
from app.db.session import get_db
from app.models.category import Category
from app.models.post import Post
from app.models.user import User
from app.schemas.notification import NotificationCreate
from app.schemas.post import (
    POST_TYPE_RECRUIT,
    RECRUIT_APPLICATION_STATUS_ACCEPTED,
    RECRUIT_APPLICATION_STATUS_REJECTED,
    PostCreate,
    PostListResponse,
    PostResponse,
    PostUpdate,
    RecruitApplicationCreate,
    RecruitApplicationResponse,
    RecruitApplicationStatusUpdate,
)

router = APIRouter()
NOTICE_CATEGORY_SLUG = "notice"
RECRUIT_CATEGORY_SLUG = "team-recruit"
RECRUIT_CATEGORY_NAME = "팀 모집"


def get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


def ensure_notice_write_permission(category: Category, current_user: User) -> None:
    if category.slug == NOTICE_CATEGORY_SLUG and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can write notice posts",
        )


def get_recruit_category_or_400(db: Session) -> Category:
    recruit_category = (
        db.query(Category)
        .filter(
            or_(
                Category.slug == RECRUIT_CATEGORY_SLUG,
                Category.name == RECRUIT_CATEGORY_NAME,
            )
        )
        .first()
    )
    if not recruit_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="모집 전용 카테고리(팀 모집)가 없습니다. 관리자에게 문의해주세요.",
        )
    return recruit_category


def ensure_recruit_category_rule(
    db: Session,
    category: Category,
    post_type: Optional[str],
) -> None:
    if post_type != POST_TYPE_RECRUIT:
        return
    recruit_category = get_recruit_category_or_400(db)
    if category.id != recruit_category.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="모집 글은 팀 모집 카테고리에서만 작성할 수 있습니다.",
        )


def _serialize_recruit_meta(post: Post) -> Optional[dict]:
    recruit_meta = post.recruit_meta
    if recruit_meta is None:
        return None
    return {
        "recruit_type": recruit_meta.recruit_type,
        "status": recruit_meta.status,
        "is_online": recruit_meta.is_online,
        "location_text": recruit_meta.location_text,
        "schedule_text": recruit_meta.schedule_text,
        "headcount_max": recruit_meta.headcount_max,
        "deadline_at": recruit_meta.deadline_at,
    }


def _build_post_response(
    post: Post,
    comment_count: int,
    likes_count: int,
    is_liked: bool,
    is_bookmarked: bool,
    views: Optional[int] = None,
) -> PostResponse:
    return PostResponse(
        id=post.id,
        title=post.title,
        content=post.content,
        views=post.views if views is None else views,
        user_id=post.user_id,
        category_id=post.category_id,
        post_type=post.post_type or "NORMAL",
        recruit_meta=_serialize_recruit_meta(post),
        created_at=post.created_at,
        updated_at=post.updated_at,
        author_username=post.author.username if post.author else None,
        author_profile_image_url=post.author.profile_image_url if post.author else None,
        comment_count=comment_count,
        likes_count=likes_count,
        is_liked=is_liked,
        is_bookmarked=is_bookmarked,
        is_pinned=post.is_pinned or False,
        category_name=post.category.name if post.category else None,
        category_slug=post.category.slug if post.category else None,
    )


def _ensure_recruit_post_or_400(db: Session, post_id: int) -> Post:
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )
    if post.post_type != POST_TYPE_RECRUIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="모집 글이 아닙니다.",
        )
    return post


def _build_application_response(application) -> RecruitApplicationResponse:
    return RecruitApplicationResponse(
        id=application.id,
        recruit_post_id=application.recruit_post_id,
        applicant_id=application.applicant_id,
        applicant_username=application.applicant.username if application.applicant else None,
        applicant_profile_image_url=(
            application.applicant.profile_image_url if application.applicant else None
        ),
        message=application.message,
        link=application.link,
        status=application.status,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.get("/", response_model=PostListResponse)
def get_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    sort: Optional[str] = Query("latest"),
    window: Optional[str] = Query("24h"),
    post_type: Optional[str] = Query(None, pattern="^(NORMAL|RECRUIT)$"),
    recruit_type: Optional[str] = Query(None),
    recruit_status: Optional[str] = Query(None, pattern="^(OPEN|CLOSED)$"),
    recruit_is_online: Optional[bool] = Query(None),
    scope: Optional[str] = Query("all", pattern="^(all|following)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    skip = (page - 1) * page_size
    normalized_scope = (scope or "all").lower()
    author_ids: Optional[list[int]] = None

    if normalized_scope == "following":
        if not current_user:
            return {
                "total": 0,
                "page": page,
                "page_size": page_size,
                "posts": [],
            }
        author_ids = crud_follow.get_following_user_ids(db, follower_id=current_user.id)
        if not author_ids:
            return {
                "total": 0,
                "page": page,
                "page_size": page_size,
                "posts": [],
            }

    posts, total = crud_post.get_posts(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        category_id=category_id,
        sort=sort or "latest",
        window=window or "24h",
        post_type=post_type,
        recruit_type=recruit_type,
        recruit_status=recruit_status,
        recruit_is_online=recruit_is_online,
        author_ids=author_ids,
    )

    post_ids = [post.id for post in posts]
    (
        comment_count_by_post_id,
        likes_count_by_post_id,
        liked_post_ids_for_user,
        bookmarked_post_ids_for_user,
    ) = crud_post.get_post_engagement_maps(
        db,
        post_ids=post_ids,
        user_id=current_user.id if current_user else None,
    )

    post_responses = [
        _build_post_response(
            post=post,
            comment_count=comment_count_by_post_id.get(post.id, 0),
            likes_count=likes_count_by_post_id.get(post.id, 0),
            is_liked=post.id in liked_post_ids_for_user,
            is_bookmarked=post.id in bookmarked_post_ids_for_user,
        )
        for post in posts
    ]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "posts": post_responses,
    }


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    post = crud_post.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    crud_post.increment_views(db, post_id)

    (
        comment_count_by_post_id,
        likes_count_by_post_id,
        liked_post_ids_for_user,
        bookmarked_post_ids_for_user,
    ) = crud_post.get_post_engagement_maps(
        db,
        post_ids=[post.id],
        user_id=current_user.id if current_user else None,
    )

    return _build_post_response(
        post=post,
        comment_count=comment_count_by_post_id.get(post.id, 0),
        likes_count=likes_count_by_post_id.get(post.id, 0),
        is_liked=post.id in liked_post_ids_for_user,
        is_bookmarked=post.id in bookmarked_post_ids_for_user,
        views=post.views + 1,
    )


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = get_category_or_404(db, post.category_id)
    ensure_notice_write_permission(category, current_user)
    ensure_recruit_category_rule(db, category, post.post_type)

    try:
        db_post = crud_post.create_post(db, post, current_user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return _build_post_response(
        post=db_post,
        comment_count=0,
        likes_count=0,
        is_liked=False,
        is_bookmarked=False,
    )


@router.put("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    post_update: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_post.get_post(db, post_id)
    if not db_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if db_post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    target_category_id = (
        post_update.category_id if post_update.category_id is not None else db_post.category_id
    )
    target_category = get_category_or_404(db, target_category_id)
    ensure_notice_write_permission(target_category, current_user)
    target_post_type = post_update.post_type if post_update.post_type is not None else db_post.post_type
    ensure_recruit_category_rule(db, target_category, target_post_type)

    try:
        updated_post = crud_post.update_post(db, post_id, post_update)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return _build_post_response(
        post=updated_post,
        comment_count=crud_post.get_comment_count(db, post_id),
        likes_count=crud_post.get_likes_count(db, post_id),
        is_liked=crud_post.check_user_liked(db, post_id, current_user.id),
        is_bookmarked=crud_post.check_user_bookmarked(db, post_id, current_user.id),
    )


@router.post(
    "/{post_id}/applications",
    response_model=RecruitApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_recruit_post(
    post_id: int,
    application: RecruitApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _ensure_recruit_post_or_400(db, post_id)
    recruit_meta = post.recruit_meta

    if recruit_meta is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="모집 정보가 없습니다.",
        )

    if post.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인 모집글에는 지원할 수 없습니다.",
        )

    deadline_at = recruit_meta.deadline_at
    if recruit_meta.status != "OPEN" or (
        deadline_at is not None and deadline_at <= datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="마감된 모집입니다.",
        )

    existing = crud_recruit_application.get_application_by_post_and_applicant(
        db,
        recruit_post_id=post.id,
        applicant_id=current_user.id,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 지원한 모집글입니다.",
        )

    try:
        created = crud_recruit_application.create_application(
            db,
            recruit_post_id=post.id,
            applicant_id=current_user.id,
            message=application.message.strip(),
            link=application.link.strip() if application.link else None,
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 지원한 모집글입니다.",
        ) from exc

    if post.user_id != current_user.id:
        try:
            crud_notification.create_notification(
                db,
                NotificationCreate(
                    user_id=post.user_id,
                    type="recruit_application",
                    content=f"{current_user.username}님이 모집글에 지원했습니다.",
                    related_post_id=post.id,
                ),
            )
        except Exception:
            pass

    refreshed = crud_recruit_application.get_application(db, created.id)
    return _build_application_response(refreshed)


@router.get("/{post_id}/applications", response_model=List[RecruitApplicationResponse])
def get_recruit_applications(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _ensure_recruit_post_or_400(db, post_id)
    if post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    applications = crud_recruit_application.list_applications_by_post(db, post.id)
    return [_build_application_response(application) for application in applications]


@router.patch(
    "/{post_id}/applications/{application_id}",
    response_model=RecruitApplicationResponse,
)
def update_recruit_application_status(
    post_id: int,
    application_id: int,
    payload: RecruitApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _ensure_recruit_post_or_400(db, post_id)
    if post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    application = crud_recruit_application.get_application(db, application_id)
    if not application or application.recruit_post_id != post.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="지원 내역을 찾을 수 없습니다.",
        )

    updated = crud_recruit_application.update_application_status(
        db,
        application=application,
        status=payload.status,
    )

    if updated.applicant_id != current_user.id:
        try:
            status_label = (
                "수락"
                if payload.status == RECRUIT_APPLICATION_STATUS_ACCEPTED
                else "거절"
                if payload.status == RECRUIT_APPLICATION_STATUS_REJECTED
                else payload.status
            )
            crud_notification.create_notification(
                db,
                NotificationCreate(
                    user_id=updated.applicant_id,
                    type="recruit_application_status",
                    content=f"모집 지원 결과가 {status_label}되었습니다.",
                    related_post_id=post.id,
                ),
            )
        except Exception:
            pass

    refreshed = crud_recruit_application.get_application(db, updated.id)
    return _build_application_response(refreshed)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_post = crud_post.get_post(db, post_id)
    if not db_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if db_post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    crud_post.delete_post(db, post_id)
    return None
