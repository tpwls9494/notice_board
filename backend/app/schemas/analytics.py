from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AnalyticsEventCreate(BaseModel):
    event_name: str = Field(..., min_length=2, max_length=100)
    page: str | None = Field(default=None, max_length=255)
    referrer: str | None = Field(default=None, max_length=255)
    properties: dict[str, Any] = Field(default_factory=dict)


class AnalyticsEventCreateResponse(BaseModel):
    status: str = "ok"


class AnalyticsSummaryItem(BaseModel):
    event_name: str
    count: int


class AnalyticsSummaryResponse(BaseModel):
    from_date: datetime
    to_date: datetime
    total_events: int
    unique_users: int
    by_event: list[AnalyticsSummaryItem]
