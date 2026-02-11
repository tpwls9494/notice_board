from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from app.models.mcp_category import McpCategory
from app.models.mcp_server import McpServer
from app.schemas.mcp_category import McpCategoryCreate, McpCategoryUpdate


def get_mcp_categories(db: Session, skip: int = 0, limit: int = 100) -> List[McpCategory]:
    return (
        db.query(McpCategory)
        .order_by(McpCategory.display_order, McpCategory.name)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_mcp_category(db: Session, category_id: int) -> Optional[McpCategory]:
    return db.query(McpCategory).filter(McpCategory.id == category_id).first()


def get_mcp_category_by_slug(db: Session, slug: str) -> Optional[McpCategory]:
    return db.query(McpCategory).filter(McpCategory.slug == slug).first()


def get_mcp_category_by_name(db: Session, name: str) -> Optional[McpCategory]:
    return db.query(McpCategory).filter(McpCategory.name == name).first()


def get_server_count(db: Session, category_id: int) -> int:
    return db.query(sa_func.count(McpServer.id)).filter(McpServer.category_id == category_id).scalar()


def create_mcp_category(db: Session, category: McpCategoryCreate) -> McpCategory:
    db_category = McpCategory(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def update_mcp_category(db: Session, category_id: int, category_update: McpCategoryUpdate) -> Optional[McpCategory]:
    db_category = get_mcp_category(db, category_id)
    if not db_category:
        return None

    update_data = category_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)

    db.commit()
    db.refresh(db_category)
    return db_category


def delete_mcp_category(db: Session, category_id: int) -> bool:
    db_category = get_mcp_category(db, category_id)
    if not db_category:
        return False
    db.delete(db_category)
    db.commit()
    return True
