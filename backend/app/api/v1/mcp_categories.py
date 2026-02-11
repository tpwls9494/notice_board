from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.schemas.mcp_category import McpCategoryCreate, McpCategoryUpdate, McpCategoryResponse
from app.crud import mcp_category as crud_mcp_category
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[McpCategoryResponse])
def get_mcp_categories(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    categories = crud_mcp_category.get_mcp_categories(db, skip=skip, limit=limit)
    return [
        McpCategoryResponse(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            description=cat.description,
            icon=cat.icon,
            display_order=cat.display_order,
            server_count=crud_mcp_category.get_server_count(db, cat.id),
            created_at=cat.created_at,
        )
        for cat in categories
    ]


@router.get("/{category_id}", response_model=McpCategoryResponse)
def get_mcp_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    category = crud_mcp_category.get_mcp_category(db, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP category not found",
        )
    return McpCategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        icon=category.icon,
        display_order=category.display_order,
        server_count=crud_mcp_category.get_server_count(db, category.id),
        created_at=category.created_at,
    )


@router.post("/", response_model=McpCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_mcp_category(
    category: McpCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    existing = crud_mcp_category.get_mcp_category_by_name(db, category.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name already exists",
        )

    db_category = crud_mcp_category.create_mcp_category(db, category)
    return McpCategoryResponse(
        id=db_category.id,
        name=db_category.name,
        slug=db_category.slug,
        description=db_category.description,
        icon=db_category.icon,
        display_order=db_category.display_order,
        server_count=0,
        created_at=db_category.created_at,
    )


@router.put("/{category_id}", response_model=McpCategoryResponse)
def update_mcp_category(
    category_id: int,
    category_update: McpCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    updated = crud_mcp_category.update_mcp_category(db, category_id, category_update)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP category not found",
        )

    return McpCategoryResponse(
        id=updated.id,
        name=updated.name,
        slug=updated.slug,
        description=updated.description,
        icon=updated.icon,
        display_order=updated.display_order,
        server_count=crud_mcp_category.get_server_count(db, updated.id),
        created_at=updated.created_at,
    )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcp_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    success = crud_mcp_category.delete_mcp_category(db, category_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP category not found",
        )
