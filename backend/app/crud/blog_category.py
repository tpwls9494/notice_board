from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.blog_category import BlogCategory


def get_blog_categories(db: Session):
    return (
        db.query(BlogCategory)
        .order_by(BlogCategory.order.asc(), BlogCategory.id.asc())
        .all()
    )


def create_blog_category(db: Session, name: str):
    max_order = db.query(func.coalesce(func.max(BlogCategory.order), 0)).scalar()
    category = BlogCategory(name=name, order=max_order + 1)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def delete_blog_category(db: Session, category_id: int):
    category = db.query(BlogCategory).filter(BlogCategory.id == category_id).first()
    if not category:
        return False
    db.delete(category)
    db.commit()
    return True
