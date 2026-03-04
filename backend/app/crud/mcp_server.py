import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import case, desc, or_, func as sa_func
from app.models.mcp_server import McpServer
from app.models.mcp_review import McpReview
from app.models.mcp_tool import McpTool
from app.models.mcp_install_guide import McpInstallGuide
from app.schemas.mcp_server import McpServerCreate, McpServerUpdate


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def _build_hybrid_score_expression(db: Session):
    # Per-server counts via correlated subqueries.
    tool_count_subquery = (
        db.query(sa_func.count(McpTool.id))
        .filter(McpTool.server_id == McpServer.id)
        .correlate(McpServer)
        .scalar_subquery()
    )
    guide_count_subquery = (
        db.query(sa_func.count(McpInstallGuide.id))
        .filter(McpInstallGuide.server_id == McpServer.id)
        .correlate(McpServer)
        .scalar_subquery()
    )

    # Bayesian rating keeps low-review servers from being over-ranked.
    global_avg_rating = (
        db.query(sa_func.coalesce(sa_func.avg(McpReview.rating), 0.0))
        .scalar()
        or 0.0
    )
    prior_review_weight = 5.0

    review_count_expr = sa_func.coalesce(McpServer.review_count, 0)
    avg_rating_expr = sa_func.coalesce(McpServer.avg_rating, 0.0)
    bayesian_rating_expr = (
        (avg_rating_expr * review_count_expr) + (prior_review_weight * global_avg_rating)
    ) / (review_count_expr + prior_review_weight)

    # Weighted hybrid score:
    # quality + popularity + review confidence + completeness (+ lightweight curation bonus).
    hybrid_score_expr = (
        (bayesian_rating_expr / 5.0) * 0.42
        + (sa_func.coalesce(McpServer.github_stars, 0) / 100000.0) * 0.20
        + (review_count_expr / 50.0) * 0.14
        + (sa_func.coalesce(tool_count_subquery, 0) / 20.0) * 0.12
        + (sa_func.coalesce(guide_count_subquery, 0) / 8.0) * 0.08
        + case((McpServer.is_verified.is_(True), 0.03), else_=0.0)
        + case((McpServer.is_featured.is_(True), 0.02), else_=0.0)
    )

    return hybrid_score_expr


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
    elif sort_by in {"hybrid", "recommended"}:
        hybrid_score_expr = _build_hybrid_score_expression(db)
        query = query.order_by(
            desc(hybrid_score_expr),
            desc(McpServer.avg_rating),
            desc(McpServer.review_count),
            desc(McpServer.created_at),
        )
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
