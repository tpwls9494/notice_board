from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate
from sqlalchemy import desc


def create_notification(db: Session, notification: NotificationCreate):
    """Create a notification"""
    db_notification = Notification(**notification.dict())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification


def get_notification(db: Session, notification_id: int):
    """Get a notification by ID"""
    return db.query(Notification).filter(Notification.id == notification_id).first()


def get_user_notifications(db: Session, user_id: int, skip: int = 0, limit: int = 20):
    """Get all notifications for a user (ordered by latest first)"""
    return db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(desc(Notification.created_at)).offset(skip).limit(limit).all()


def get_unread_notifications_count(db: Session, user_id: int):
    """Get the count of unread notifications for a user"""
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()


def mark_notification_as_read(db: Session, notification_id: int):
    """Mark a notification as read"""
    db_notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()

    if db_notification:
        db_notification.is_read = True
        db.commit()
        db.refresh(db_notification)
        return db_notification
    return None


def mark_all_notifications_as_read(db: Session, user_id: int):
    """Mark all notifications as read for a user"""
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return True


def delete_notification(db: Session, notification_id: int):
    """Delete a notification"""
    db_notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()

    if db_notification:
        db.delete(db_notification)
        db.commit()
        return True
    return False
