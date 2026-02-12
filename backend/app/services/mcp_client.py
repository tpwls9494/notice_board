import asyncio
import json
import logging
import os
import shlex
import shutil
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from typing import Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud import mcp_server as crud_mcp_server
from app.crud import mcp_tool as crud_mcp_tool

logger = logging.getLogger(__name__)


def _build_subprocess_env() -> dict[str, str] | None:
    """MCP 서버 서브프로세스용 환경변수를 반환합니다. uvx/npx 등을 찾을 수 있도록 PATH를 보강."""
    env = os.environ.copy()
    extra_paths = [
        os.path.expanduser("~/.local/bin"),  # uv/uvx 기본 설치 경로
        "/usr/local/bin",                     # Homebrew (Intel Mac)
        "/opt/homebrew/bin",                  # Homebrew (Apple Silicon)
    ]
    current_path = env.get("PATH", "")
    added = False
    for p in extra_paths:
        if p not in current_path and os.path.isdir(p):
            current_path = p + ":" + current_path
            added = True
    if not added:
        return None
    env["PATH"] = current_path
    return env


@dataclass
class McpConnection:
    server_slug: str
    session: ClientSession
    exit_stack: AsyncExitStack
    last_used: float = field(default_factory=time.time)


class McpConnectionManager:
    """slug별 MCP 서버 서브프로세스 연결을 관리합니다."""

    def __init__(self):
        self._connections: dict[str, McpConnection] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()
        self._allowed_slugs: set[str] = set(
            s.strip() for s in settings.MCP_ALLOWED_SERVERS.split(",") if s.strip()
        )

    def is_allowed(self, slug: str) -> bool:
        return slug in self._allowed_slugs

    def has_connection(self, slug: str) -> bool:
        return slug in self._connections

    def get_connection(self, slug: str) -> Optional[McpConnection]:
        conn = self._connections.get(slug)
        if conn:
            conn.last_used = time.time()
        return conn

    async def _get_lock(self, slug: str) -> asyncio.Lock:
        async with self._global_lock:
            if slug not in self._locks:
                self._locks[slug] = asyncio.Lock()
            return self._locks[slug]

    async def get_or_create_session(
        self, server_slug: str, install_command: str
    ) -> ClientSession:
        lock = await self._get_lock(server_slug)
        async with lock:
            # 기존 연결이 있으면 재사용
            existing = self._connections.get(server_slug)
            if existing:
                existing.last_used = time.time()
                return existing.session

            # install_command를 command + args로 분리 (shell injection 방지)
            parts = shlex.split(install_command)
            command = parts[0]
            args = parts[1:]

            server_params = StdioServerParameters(
                command=command, args=args, env=_build_subprocess_env()
            )

            exit_stack = AsyncExitStack()
            try:
                transport = await exit_stack.enter_async_context(
                    stdio_client(server_params)
                )
                read_stream, write_stream = transport
                session = await exit_stack.enter_async_context(
                    ClientSession(read_stream, write_stream)
                )
                await asyncio.wait_for(
                    session.initialize(),
                    timeout=settings.MCP_CONNECT_TIMEOUT,
                )
            except Exception:
                await exit_stack.aclose()
                raise

            conn = McpConnection(
                server_slug=server_slug,
                session=session,
                exit_stack=exit_stack,
            )
            self._connections[server_slug] = conn
            logger.info(f"MCP 실제 연결 성공: {server_slug}")
            return session

    async def disconnect(self, server_slug: str):
        lock = await self._get_lock(server_slug)
        async with lock:
            conn = self._connections.pop(server_slug, None)
            if conn:
                try:
                    await conn.exit_stack.aclose()
                except Exception as e:
                    logger.warning(f"MCP 연결 종료 중 오류 ({server_slug}): {e}")
                logger.info(f"MCP 연결 종료: {server_slug}")

    async def disconnect_all(self):
        slugs = list(self._connections.keys())
        for slug in slugs:
            await self.disconnect(slug)


class McpPlaygroundService:
    """
    MCP 플레이그라운드 서비스.
    허용 목록의 서버는 실제 MCP 프로토콜로 연결하고,
    나머지는 기존 시뮬레이션(DB sample_output)으로 동작합니다.
    """

    def __init__(self):
        self._manager = McpConnectionManager()

    async def connect(self, db: Session, server_id: int) -> dict:
        server = crud_mcp_server.get_mcp_server(db, server_id)
        if not server:
            return {
                "server_id": server_id,
                "server_name": "",
                "status": "error",
                "error": "Server not found",
                "tools": [],
                "is_real_connection": False,
            }

        # 실제 연결 시도 (허용 목록 + install_command 존재)
        if server.install_command and self._manager.is_allowed(server.slug):
            try:
                session = await self._manager.get_or_create_session(
                    server.slug, server.install_command
                )
                response = await session.list_tools()
                tool_list = [
                    {
                        "name": tool.name,
                        "description": tool.description or "",
                        "input_schema": tool.inputSchema if hasattr(tool, 'inputSchema') else {},
                    }
                    for tool in response.tools
                ]
                return {
                    "server_id": server.id,
                    "server_name": server.name,
                    "status": "connected",
                    "tools": tool_list,
                    "is_real_connection": True,
                }
            except FileNotFoundError:
                logger.warning(f"MCP 서버 실행 파일을 찾을 수 없습니다 ({server.slug}): Node.js/npx가 설치되어 있는지 확인하세요")
            except asyncio.TimeoutError:
                logger.warning(f"MCP 서버 연결 타임아웃 ({server.slug})")
            except Exception as e:
                logger.warning(f"MCP 실제 연결 실패 ({server.slug}): {e}")
            # 실제 연결 실패 시 시뮬레이션으로 fallback

        # 시뮬레이션 (DB 기반)
        tools = crud_mcp_tool.get_tools_by_server(db, server_id)
        tool_list = [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": json.loads(tool.input_schema) if tool.input_schema else {},
            }
            for tool in tools
        ]
        return {
            "server_id": server.id,
            "server_name": server.name,
            "status": "connected",
            "tools": tool_list,
            "is_real_connection": False,
        }

    async def invoke_tool(
        self, db: Session, server_id: int, tool_name: str, arguments: dict
    ) -> dict:
        start_time = time.time()

        server = crud_mcp_server.get_mcp_server(db, server_id)
        if not server:
            return {"server_id": server_id, "tool_name": tool_name, "error": "Server not found"}

        # 실제 연결이 활성화된 경우
        conn = self._manager.get_connection(server.slug) if server else None
        if conn:
            try:
                result = await asyncio.wait_for(
                    conn.session.call_tool(tool_name, arguments),
                    timeout=settings.MCP_INVOKE_TIMEOUT,
                )

                # MCP CallToolResult → 응답 포맷 변환
                content = []
                for item in result.content:
                    if hasattr(item, "text"):
                        content.append({"type": "text", "text": item.text})
                    elif hasattr(item, "data"):
                        content.append({"type": "image", "data": item.data, "mimeType": getattr(item, "mimeType", "")})

                elapsed = (time.time() - start_time) * 1000
                return {
                    "server_id": server_id,
                    "tool_name": tool_name,
                    "result": {"content": content, "isError": getattr(result, "isError", False)},
                    "execution_time_ms": round(elapsed, 2),
                }
            except asyncio.TimeoutError:
                elapsed = (time.time() - start_time) * 1000
                return {
                    "server_id": server_id,
                    "tool_name": tool_name,
                    "error": f"Tool 실행 타임아웃 ({settings.MCP_INVOKE_TIMEOUT}초)",
                    "execution_time_ms": round(elapsed, 2),
                }
            except Exception as e:
                logger.error(f"MCP tool 실행 실패 ({server.slug}/{tool_name}): {e}")
                # 연결이 깨졌을 수 있으므로 제거
                await self._manager.disconnect(server.slug)
                elapsed = (time.time() - start_time) * 1000
                return {
                    "server_id": server_id,
                    "tool_name": tool_name,
                    "error": f"Tool 실행 실패: {str(e)}",
                    "execution_time_ms": round(elapsed, 2),
                }

        # 시뮬레이션 fallback
        tools = crud_mcp_tool.get_tools_by_server(db, server_id)
        tool = next((t for t in tools if t.name == tool_name), None)
        if not tool:
            return {"server_id": server_id, "tool_name": tool_name, "error": f"Tool '{tool_name}' not found"}

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

        elapsed = (time.time() - start_time) * 1000
        return {
            "server_id": server_id,
            "tool_name": tool_name,
            "result": result,
            "execution_time_ms": round(elapsed, 2),
        }

    async def shutdown(self):
        await self._manager.disconnect_all()


playground_service = McpPlaygroundService()
