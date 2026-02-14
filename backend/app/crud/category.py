from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.category import Category
from app.models.post import Post
from app.schemas.category import CategoryCreate, CategoryUpdate

KST = timezone(timedelta(hours=9))


def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Category)
        .filter(Category.is_active == True)
        .order_by(Category.order.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_categories_with_today_count(db: Session, skip: int = 0, limit: int = 100):
    """카테고리 목록 + KST 기준 오늘 새 글 수"""
    now_kst = datetime.now(KST)
    today_start_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_kst.astimezone(timezone.utc)

    today_sub = (
        db.query(
            Post.category_id,
            func.count(Post.id).label("today_post_count"),
        )
        .filter(Post.created_at >= today_start_utc)
        .group_by(Post.category_id)
        .subquery()
    )

    rows = (
        db.query(Category, func.coalesce(today_sub.c.today_post_count, 0))
        .outerjoin(today_sub, Category.id == today_sub.c.category_id)
        .filter(Category.is_active == True)
        .order_by(Category.order.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for cat, count in rows:
        cat.today_post_count = count
        results.append(cat)
    return results


def get_category(db: Session, category_id: int):
    return db.query(Category).filter(Category.id == category_id).first()


def get_category_by_name(db: Session, name: str):
    return db.query(Category).filter(Category.name == name).first()


def create_category(db: Session, category: CategoryCreate):
    db_category = Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def update_category(db: Session, category_id: int, category_update: CategoryUpdate):
    db_category = get_category(db, category_id)
    if not db_category:
        return None

    update_data = category_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_category, field, value)

    db.commit()
    db.refresh(db_category)
    return db_category


def delete_category(db: Session, category_id: int):
    db_category = get_category(db, category_id)
    if db_category:
        db.delete(db_category)
        db.commit()
        return True
    return False
