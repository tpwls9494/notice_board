import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud import notification as crud_notification
from app.crud import post as crud_post
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
)

router = APIRouter()


def _localize_notification_content(notification_type: str, content: str | None) -> str:
    if not content:
        return "새 알림이 도착했습니다."

    if any("가" <= ch <= "힣" for ch in content):
        return content

    if notification_type == "like":
        actor_match = re.match(r"^(.+?) liked your post\.?$", content, flags=re.IGNORECASE)
        if actor_match:
            return f"{actor_match.group(1)}님이 회원님의 게시글을 좋아합니다."
        return "회원님의 게시글에 새 좋아요가 있습니다."

    if notification_type == "comment":
        actor_match = re.match(r"^(.+?) commented on your post\.?$", content, flags=re.IGNORECASE)
        if actor_match:
            return f"{actor_match.group(1)}님이 회원님의 게시글에 댓글을 남겼습니다."
        return "회원님의 게시글에 새 댓글이 달렸습니다."

    return content


@router.get("/me", response_model=NotificationListResponse)
def get_my_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    notifications = crud_notification.get_user_notifications(
        db, user_id=current_user.id, skip=skip, limit=page_size
    )
    total = crud_notification.get_user_notifications_count(db, current_user.id)

    notification_items = []
    for notification in notifications:
        post_title = None
        if notification.related_post_id:
            post = crud_post.get_post(db, notification.related_post_id)
            post_title = post.title if post else None

        notification_items.append(
            NotificationResponse(
                id=notification.id,
                user_id=notification.user_id,
                type=notification.type,
                content=_localize_notification_content(notification.type, notification.content),
                related_post_id=notification.related_post_id,
                related_comment_id=notification.related_comment_id,
                post_title=post_title,
                is_read=notification.is_read,
                created_at=notification.created_at,
            )
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "notifications": notification_items,
    }


@router.get("/me/unread-count", response_model=NotificationUnreadCountResponse)
def get_my_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unread_count = crud_notification.get_unread_notifications_count(db, current_user.id)
    return {"unread_count": unread_count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = crud_notification.get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없습니다.",
        )
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다.",
        )

    updated = crud_notification.mark_notification_as_read(db, notification_id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없습니다.",
        )

    post_title = None
    if updated.related_post_id:
        post = crud_post.get_post(db, updated.related_post_id)
        post_title = post.title if post else None

    return NotificationResponse(
        id=updated.id,
        user_id=updated.user_id,
        type=updated.type,
        content=_localize_notification_content(updated.type, updated.content),
        related_post_id=updated.related_post_id,
        related_comment_id=updated.related_comment_id,
        post_title=post_title,
        is_read=updated.is_read,
        created_at=updated.created_at,
    )


@router.patch("/me/read-all")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crud_notification.mark_all_notifications_as_read(db, current_user.id)
    return {"detail": "모든 알림을 읽음 처리했습니다."}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = crud_notification.get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없습니다.",
        )
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다.",
        )

    success = crud_notification.delete_notification(db, notification_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없습니다.",
        )

    return None
