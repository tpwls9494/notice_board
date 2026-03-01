from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_admin, get_current_user_optional
from app.crud import analytics as crud_analytics
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsEventCreate,
    AnalyticsEventCreateResponse,
    AnalyticsSummaryResponse,
)

router = APIRouter()

ALLOWED_EVENTS = {
    "weekly_summary_impression",
    "weekly_summary_click",
    "dev_news_post_view",
    "login_success",
}


@router.post("/events", response_model=AnalyticsEventCreateResponse, status_code=status.HTTP_202_ACCEPTED)
def create_analytics_event(
    payload: AnalyticsEventCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    event_name = payload.event_name.strip().lower()
    if event_name not in ALLOWED_EVENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported analytics event",
        )

    properties = payload.properties or {}
    if len(properties) > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many event properties",
        )

    page = (payload.page or request.headers.get("x-page") or "").strip() or None
    if page:
        page = page[:255]

    referrer = (payload.referrer or request.headers.get("referer") or "").strip() or None
    if referrer:
        referrer = referrer[:255]

    crud_analytics.create_event(
        db=db,
        event_name=event_name,
        user_id=current_user.id if current_user else None,
        page=page,
        referrer=referrer,
        properties=properties,
    )
    return AnalyticsEventCreateResponse(status="ok")


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_active_admin),
):
    summary = crud_analytics.get_summary(db, days=days, limit=limit)
    return AnalyticsSummaryResponse(**summary)
