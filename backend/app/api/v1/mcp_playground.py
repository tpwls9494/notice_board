from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.mcp_playground import (
    PlaygroundConnectRequest, PlaygroundConnectResponse,
    PlaygroundInvokeRequest, PlaygroundInvokeResponse,
    PlaygroundUsageResponse,
)
from app.models.user import User
from app.services.mcp_client import McpPlaygroundService
from app.crud import playground_usage as crud_usage

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

    # 사용량 기록
    crud_usage.create_usage(
        db,
        user_id=current_user.id,
        server_id=request.server_id,
        tool_name=request.tool_name,
        execution_time_ms=result.get("execution_time_ms") if isinstance(result, dict) else None,
    )

    return result


@router.get("/usage-history")
def get_usage_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    usages = crud_usage.get_user_usages(db, current_user.id, skip, page_size)
    total = crud_usage.get_user_usage_count(db, current_user.id)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "usages": [
            PlaygroundUsageResponse.model_validate(u).model_dump()
            for u in usages
        ],
    }
