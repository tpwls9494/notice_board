from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.mcp_playground import (
    PlaygroundConnectRequest, PlaygroundConnectResponse,
    PlaygroundInvokeRequest, PlaygroundInvokeResponse,
)
from app.models.user import User
from app.services.mcp_client import McpPlaygroundService

router = APIRouter()

playground_service = McpPlaygroundService()


@router.post("/connect", response_model=PlaygroundConnectResponse)
async def connect_to_server(
    request: PlaygroundConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = await playground_service.connect(db, request.server_id)
    return result


@router.post("/invoke", response_model=PlaygroundInvokeResponse)
async def invoke_tool(
    request: PlaygroundInvokeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = await playground_service.invoke_tool(
        db, request.server_id, request.tool_name, request.arguments
    )
    return result
