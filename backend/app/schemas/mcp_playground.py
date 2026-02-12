from datetime import datetime
from pydantic import BaseModel


class PlaygroundConnectRequest(BaseModel):
    server_id: int


class PlaygroundConnectResponse(BaseModel):
    server_id: int
    server_name: str
    status: str
    tools: list[dict] = []
    error: str | None = None
    is_real_connection: bool = False


class PlaygroundInvokeRequest(BaseModel):
    server_id: int
    tool_name: str
    arguments: dict = {}


class PlaygroundInvokeResponse(BaseModel):
    server_id: int
    tool_name: str
    result: dict | list | str | None = None
    error: str | None = None
    execution_time_ms: float | None = None


class PlaygroundUsageResponse(BaseModel):
    id: int
    server_id: int | None
    tool_name: str
    execution_time_ms: float | None
    created_at: datetime

    class Config:
        from_attributes = True
