import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func as sa_func
from app.models.mcp_server import McpServer
from app.models.mcp_review import McpReview
from app.schemas.mcp_server import McpServerCreate, McpServerUpdate


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def get_mcp_server(db: Session, server_id: int) -> Optional[McpServer]:
    return db.query(McpServer).filter(McpServer.id == server_id).first()


def get_mcp_server_by_slug(db: Session, slug: str) -> Optional[McpServer]:
    return db.query(McpServer).filter(McpServer.slug == slug).first()


def get_mcp_servers(
    db: Session,
    skip: int = 0,
    limit: int = 12,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_featured: Optional[bool] = None,
    sort_by: str = "newest",
) -> Tuple[List[McpServer], int]:
    query = db.query(McpServer)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                McpServer.name.ilike(search_filter),
                McpServer.description.ilike(search_filter),
            )
        )

    if category_id:
        query = query.filter(McpServer.category_id == category_id)

    if is_featured is not None:
        query = query.filter(McpServer.is_featured == is_featured)

    total = query.count()

    if sort_by == "stars":
        query = query.order_by(desc(McpServer.github_stars))
    elif sort_by == "rating":
        query = query.order_by(desc(McpServer.avg_rating))
    else:
        query = query.order_by(desc(McpServer.created_at))

    servers = query.offset(skip).limit(limit).all()
    return servers, total


def create_mcp_server(db: Session, server: McpServerCreate, user_id: int) -> McpServer:
    server_data = server.model_dump(exclude={"tools", "install_guides"})
    slug = _slugify(server_data["name"])

    existing = get_mcp_server_by_slug(db, slug)
    if existing:
        slug = f"{slug}-{db.query(sa_func.count(McpServer.id)).scalar() + 1}"

    db_server = McpServer(**server_data, slug=slug, created_by=user_id)
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server


def update_mcp_server(db: Session, server_id: int, server_update: McpServerUpdate) -> Optional[McpServer]:
    db_server = get_mcp_server(db, server_id)
    if not db_server:
        return None

    update_data = server_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_server, key, value)

    db.commit()
    db.refresh(db_server)
    return db_server


def delete_mcp_server(db: Session, server_id: int) -> bool:
    db_server = get_mcp_server(db, server_id)
    if not db_server:
        return False
    db.delete(db_server)
    db.commit()
    return True


def update_github_stats(db: Session, server_id: int, stars: int, readme: Optional[str] = None) -> Optional[McpServer]:
    from datetime import datetime, timezone
    db_server = get_mcp_server(db, server_id)
    if not db_server:
        return None
    db_server.github_stars = stars
    if readme is not None:
        db_server.github_readme = readme
    db_server.github_last_synced = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_server)
    return db_server


def update_avg_rating(db: Session, server_id: int) -> None:
    result = db.query(
        sa_func.avg(McpReview.rating),
        sa_func.count(McpReview.id),
    ).filter(McpReview.server_id == server_id).first()

    avg_rating = float(result[0]) if result[0] else 0.0
    review_count = result[1] or 0

    db_server = get_mcp_server(db, server_id)
    if db_server:
        db_server.avg_rating = round(avg_rating, 2)
        db_server.review_count = review_count
        db.commit()
