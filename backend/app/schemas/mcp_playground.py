from pydantic import BaseModel


class PlaygroundConnectRequest(BaseModel):
    server_id: int


class PlaygroundConnectResponse(BaseModel):
    server_id: int
    server_name: str
    status: str
    tools: list[dict] = []
    error: str | None = None


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
