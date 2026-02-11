from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.mcp_tool import McpTool


def get_tools_by_server(db: Session, server_id: int) -> List[McpTool]:
    return db.query(McpTool).filter(McpTool.server_id == server_id).all()


def get_mcp_tool(db: Session, tool_id: int) -> Optional[McpTool]:
    return db.query(McpTool).filter(McpTool.id == tool_id).first()


def create_mcp_tool(db: Session, name: str, description: str, input_schema: str, server_id: int) -> McpTool:
    db_tool = McpTool(
        name=name,
        description=description,
        input_schema=input_schema,
        server_id=server_id,
    )
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool


def bulk_create_tools(db: Session, tools: list, server_id: int) -> List[McpTool]:
    db_tools = []
    for tool_data in tools:
        db_tool = McpTool(
            name=tool_data.get("name", ""),
            description=tool_data.get("description", ""),
            input_schema=tool_data.get("input_schema", ""),
            server_id=server_id,
        )
        db.add(db_tool)
        db_tools.append(db_tool)
    db.commit()
    for t in db_tools:
        db.refresh(t)
    return db_tools


def delete_tools_by_server(db: Session, server_id: int) -> int:
    count = db.query(McpTool).filter(McpTool.server_id == server_id).delete()
    db.commit()
    return count
