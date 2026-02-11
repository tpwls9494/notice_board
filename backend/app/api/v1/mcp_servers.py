from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.schemas.mcp_server import (
    McpServerCreate, McpServerUpdate, McpServerResponse, McpServerListResponse,
    McpToolCreate, McpToolResponse, McpInstallGuideCreate, McpInstallGuideResponse,
)
from app.models.user import User
from app.crud import mcp_server as crud_mcp_server
from app.crud import mcp_tool as crud_mcp_tool
from app.crud import mcp_install_guide as crud_mcp_install_guide
from app.services.github import GitHubService
from app.services.github_sync import sync_all_github_stats
from app.core.config import settings

router = APIRouter()


def _build_server_response(server) -> McpServerResponse:
    return McpServerResponse(
        id=server.id,
        name=server.name,
        slug=server.slug,
        description=server.description,
        short_description=server.short_description,
        github_url=server.github_url,
        github_stars=server.github_stars or 0,
        github_readme=server.github_readme,
        install_command=server.install_command,
        package_name=server.package_name,
        category_id=server.category_id,
        is_featured=server.is_featured,
        is_verified=server.is_verified,
        demo_video_url=server.demo_video_url,
        showcase_data=server.showcase_data,
        avg_rating=server.avg_rating or 0.0,
        review_count=server.review_count or 0,
        created_by=server.created_by,
        creator_username=server.creator.username if server.creator else None,
        category_name=server.category.name if server.category else None,
        created_at=server.created_at,
        updated_at=server.updated_at,
        tools=[McpToolResponse(id=t.id, name=t.name, description=t.description, input_schema=t.input_schema, sample_output=t.sample_output) for t in server.tools],
        install_guides=[McpInstallGuideResponse(id=g.id, client_name=g.client_name, config_json=g.config_json, instructions=g.instructions) for g in server.install_guides],
    )


@router.get("/", response_model=McpServerListResponse)
def get_mcp_servers(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    is_featured: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query("newest"),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    servers, total = crud_mcp_server.get_mcp_servers(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        category_id=category_id,
        is_featured=is_featured,
        sort_by=sort_by or "newest",
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "servers": [_build_server_response(s) for s in servers],
    }


@router.post("/sync-github-all")
async def sync_all_github(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    await sync_all_github_stats(db)
    return {"status": "ok", "message": "GitHub sync completed"}


@router.get("/{server_id}", response_model=McpServerResponse)
def get_mcp_server(
    server_id: int,
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )
    return _build_server_response(server)


@router.post("/", response_model=McpServerResponse, status_code=status.HTTP_201_CREATED)
def create_mcp_server(
    server: McpServerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_server = crud_mcp_server.create_mcp_server(db, server, current_user.id)

    if server.tools:
        crud_mcp_tool.bulk_create_tools(db, server.tools, db_server.id)

    if server.install_guides:
        for guide in server.install_guides:
            crud_mcp_install_guide.create_install_guide(
                db,
                client_name=guide.get("client_name", ""),
                config_json=guide.get("config_json", ""),
                instructions=guide.get("instructions", ""),
                server_id=db_server.id,
            )

    db.refresh(db_server)
    return _build_server_response(db_server)


@router.put("/{server_id}", response_model=McpServerResponse)
def update_mcp_server(
    server_id: int,
    server_update: McpServerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_server = crud_mcp_server.get_mcp_server(db, server_id)
    if not db_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    if db_server.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    updated = crud_mcp_server.update_mcp_server(db, server_id, server_update)
    return _build_server_response(updated)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcp_server(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_server = crud_mcp_server.get_mcp_server(db, server_id)
    if not db_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    if db_server.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    crud_mcp_server.delete_mcp_server(db, server_id)
    return None


@router.post("/{server_id}/sync-github", response_model=McpServerResponse)
async def sync_github(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    db_server = crud_mcp_server.get_mcp_server(db, server_id)
    if not db_server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    if not db_server.github_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub URL configured for this server",
        )

    github = GitHubService(token=settings.GITHUB_TOKEN)
    repo_info = await github.get_repo_info(db_server.github_url)
    readme = await github.get_readme(db_server.github_url)

    crud_mcp_server.update_github_stats(db, server_id, stars=repo_info["stars"], readme=readme)
    db.refresh(db_server)
    return _build_server_response(db_server)


# --- Tools sub-resource ---

@router.get("/{server_id}/tools", response_model=List[McpToolResponse])
def get_server_tools(
    server_id: int,
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )
    tools = crud_mcp_tool.get_tools_by_server(db, server_id)
    return [McpToolResponse(id=t.id, name=t.name, description=t.description, input_schema=t.input_schema, sample_output=t.sample_output) for t in tools]


@router.post("/{server_id}/tools", response_model=McpToolResponse, status_code=status.HTTP_201_CREATED)
def create_server_tool(
    server_id: int,
    tool: McpToolCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    if server.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    db_tool = crud_mcp_tool.create_mcp_tool(
        db, name=tool.name, description=tool.description, input_schema=tool.input_schema, server_id=server_id,
    )
    return McpToolResponse(id=db_tool.id, name=db_tool.name, description=db_tool.description, input_schema=db_tool.input_schema, sample_output=db_tool.sample_output)


# --- Install guides sub-resource ---

@router.get("/{server_id}/guides", response_model=List[McpInstallGuideResponse])
def get_install_guides(
    server_id: int,
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )
    guides = crud_mcp_install_guide.get_guides_by_server(db, server_id)
    return [McpInstallGuideResponse(id=g.id, client_name=g.client_name, config_json=g.config_json, instructions=g.instructions) for g in guides]


@router.post("/{server_id}/guides", response_model=McpInstallGuideResponse, status_code=status.HTTP_201_CREATED)
def create_install_guide(
    server_id: int,
    guide: McpInstallGuideCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    server = crud_mcp_server.get_mcp_server(db, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP server not found",
        )

    if server.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    db_guide = crud_mcp_install_guide.create_install_guide(
        db, client_name=guide.client_name, config_json=guide.config_json,
        instructions=guide.instructions, server_id=server_id,
    )
    return McpInstallGuideResponse(id=db_guide.id, client_name=db_guide.client_name, config_json=db_guide.config_json, instructions=db_guide.instructions)
