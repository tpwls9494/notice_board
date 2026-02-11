import json
import time
import random
from sqlalchemy.orm import Session
from app.crud import mcp_server as crud_mcp_server
from app.crud import mcp_tool as crud_mcp_tool


class McpPlaygroundService:
    """
    MCP server playground service.
    Currently provides simulated tool invocation using DB-stored sample outputs.
    """

    async def connect(self, db: Session, server_id: int) -> dict:
        server = crud_mcp_server.get_mcp_server(db, server_id)
        if not server:
            return {"server_id": server_id, "server_name": "", "status": "error", "error": "Server not found", "tools": []}

        tools = crud_mcp_tool.get_tools_by_server(db, server_id)
        tool_list = []
        for tool in tools:
            tool_info = {
                "name": tool.name,
                "description": tool.description,
                "input_schema": json.loads(tool.input_schema) if tool.input_schema else {},
            }
            tool_list.append(tool_info)

        return {
            "server_id": server.id,
            "server_name": server.name,
            "status": "connected",
            "tools": tool_list,
        }

    async def invoke_tool(self, db: Session, server_id: int, tool_name: str, arguments: dict) -> dict:
        start_time = time.time()

        server = crud_mcp_server.get_mcp_server(db, server_id)
        if not server:
            return {"server_id": server_id, "tool_name": tool_name, "error": "Server not found"}

        tools = crud_mcp_tool.get_tools_by_server(db, server_id)
        tool = next((t for t in tools if t.name == tool_name), None)
        if not tool:
            return {"server_id": server_id, "tool_name": tool_name, "error": f"Tool '{tool_name}' not found"}

        # sample_output이 있으면 파싱하여 반환, 없으면 기본 메시지
        if tool.sample_output:
            try:
                result = json.loads(tool.sample_output)
            except json.JSONDecodeError:
                result = {"content": [{"type": "text", "text": tool.sample_output}]}
        else:
            result = {
                "content": [
                    {"type": "text", "text": f"[Simulated] Tool '{tool_name}' executed with args: {json.dumps(arguments, ensure_ascii=False)}"}
                ]
            }

        # 시뮬레이션 딜레이 (50-200ms)
        delay = random.uniform(0.05, 0.2)
        time.sleep(delay)

        elapsed = (time.time() - start_time) * 1000
        return {
            "server_id": server_id,
            "tool_name": tool_name,
            "result": result,
            "execution_time_ms": round(elapsed, 2),
        }
