"""
MCP Marketplace seed data script.
Usage: cd backend && python -m app.seed_mcp_data
"""
import json
from app.db.base import SessionLocal
from app.models.mcp_category import McpCategory
from app.models.mcp_server import McpServer
from app.models.mcp_tool import McpTool
from app.models.mcp_install_guide import McpInstallGuide


def seed():
    db = SessionLocal()

    try:
        # --- Categories ---
        categories_data = [
            {"name": "파일 시스템", "slug": "filesystem", "icon": "folder", "description": "파일 및 디렉토리 작업 도구", "display_order": 1},
            {"name": "개발 도구", "slug": "dev-tools", "icon": "wrench", "description": "코드 작성, 버전 관리, CI/CD 도구", "display_order": 2},
            {"name": "웹", "slug": "web", "icon": "globe", "description": "웹 검색, 크롤링, API 연동", "display_order": 3},
            {"name": "데이터", "slug": "data", "icon": "database", "description": "데이터베이스, 분석, 변환 도구", "display_order": 4},
            {"name": "AI/ML", "slug": "ai-ml", "icon": "brain", "description": "AI 모델, 임베딩, 벡터 검색", "display_order": 5},
            {"name": "생산성", "slug": "productivity", "icon": "zap", "description": "노트, 캘린더, 이메일 등 생산성 도구", "display_order": 6},
        ]

        cat_map = {}
        for cat_data in categories_data:
            existing = db.query(McpCategory).filter(McpCategory.slug == cat_data["slug"]).first()
            if not existing:
                cat = McpCategory(**cat_data)
                db.add(cat)
                db.flush()
                cat_map[cat_data["slug"]] = cat.id
            else:
                cat_map[cat_data["slug"]] = existing.id

        # --- Servers ---
        servers_data = [
            {
                "name": "Filesystem Server",
                "slug": "filesystem-server",
                "description": "MCP 서버로 로컬 파일 시스템에 접근합니다. 파일 읽기, 쓰기, 디렉토리 탐색 등의 기능을 제공합니다.",
                "short_description": "로컬 파일 시스템 접근을 위한 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 15200,
                "install_command": "npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir",
                "package_name": "@modelcontextprotocol/server-filesystem",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "filesystem",
                "tools": [
                    {
                        "name": "read_file",
                        "description": "파일의 전체 내용을 읽습니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {"path": {"type": "string", "description": "읽을 파일의 경로"}},
                            "required": ["path"],
                        }),
                    },
                    {
                        "name": "write_file",
                        "description": "파일에 내용을 작성합니다. 파일이 존재하면 덮어씁니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {
                                "path": {"type": "string", "description": "작성할 파일 경로"},
                                "content": {"type": "string", "description": "파일에 작성할 내용"},
                            },
                            "required": ["path", "content"],
                        }),
                    },
                    {
                        "name": "list_directory",
                        "description": "디렉토리의 파일 및 하위 디렉토리 목록을 반환합니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {"path": {"type": "string", "description": "탐색할 디렉토리 경로"}},
                            "required": ["path"],
                        }),
                    },
                ],
                "guides": [
                    {
                        "client_name": "Claude Desktop",
                        "config_json": json.dumps({
                            "mcpServers": {
                                "filesystem": {
                                    "command": "npx",
                                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/Desktop"],
                                }
                            }
                        }, indent=2),
                        "instructions": "claude_desktop_config.json 파일에 위 설정을 추가하세요.\n경로를 실제 허용할 디렉토리로 변경하세요.",
                    },
                    {
                        "client_name": "Cursor",
                        "config_json": json.dumps({
                            "mcpServers": {
                                "filesystem": {
                                    "command": "npx",
                                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
                                }
                            }
                        }, indent=2),
                        "instructions": "Cursor Settings > MCP 탭에서 위 설정을 추가하세요.",
                    },
                ],
            },
            {
                "name": "GitHub Server",
                "slug": "github-server",
                "description": "GitHub API와 연동하여 리포지토리 관리, 이슈 생성, PR 관리 등의 기능을 제공하는 MCP 서버입니다.",
                "short_description": "GitHub API 연동 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 15200,
                "install_command": "npx -y @modelcontextprotocol/server-github",
                "package_name": "@modelcontextprotocol/server-github",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "dev-tools",
                "tools": [
                    {
                        "name": "search_repositories",
                        "description": "GitHub 리포지토리를 검색합니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {"query": {"type": "string", "description": "검색 쿼리"}},
                            "required": ["query"],
                        }),
                    },
                    {
                        "name": "get_file_contents",
                        "description": "리포지토리에서 파일 내용을 가져옵니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {
                                "owner": {"type": "string"},
                                "repo": {"type": "string"},
                                "path": {"type": "string"},
                            },
                            "required": ["owner", "repo", "path"],
                        }),
                    },
                    {
                        "name": "create_issue",
                        "description": "GitHub 이슈를 생성합니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {
                                "owner": {"type": "string"},
                                "repo": {"type": "string"},
                                "title": {"type": "string"},
                                "body": {"type": "string"},
                            },
                            "required": ["owner", "repo", "title"],
                        }),
                    },
                ],
                "guides": [
                    {
                        "client_name": "Claude Desktop",
                        "config_json": json.dumps({
                            "mcpServers": {
                                "github": {
                                    "command": "npx",
                                    "args": ["-y", "@modelcontextprotocol/server-github"],
                                    "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"},
                                }
                            }
                        }, indent=2),
                        "instructions": "GitHub Personal Access Token을 생성하여 설정에 추가하세요.\nSettings > Developer settings > Personal access tokens에서 생성할 수 있습니다.",
                    },
                ],
            },
            {
                "name": "Brave Search Server",
                "slug": "brave-search-server",
                "description": "Brave Search API를 사용하여 웹 검색과 로컬 검색 기능을 제공하는 MCP 서버입니다. 실시간 웹 정보를 AI에게 제공합니다.",
                "short_description": "Brave Search API 기반 웹/로컬 검색 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 15200,
                "install_command": "npx -y @modelcontextprotocol/server-brave-search",
                "package_name": "@modelcontextprotocol/server-brave-search",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "web",
                "tools": [
                    {
                        "name": "brave_web_search",
                        "description": "Brave Search를 사용하여 웹 검색을 수행합니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {
                                "query": {"type": "string", "description": "검색 쿼리"},
                                "count": {"type": "integer", "description": "결과 수", "default": 10},
                            },
                            "required": ["query"],
                        }),
                    },
                    {
                        "name": "brave_local_search",
                        "description": "Brave를 사용하여 로컬 비즈니스 및 장소를 검색합니다.",
                        "input_schema": json.dumps({
                            "type": "object",
                            "properties": {
                                "query": {"type": "string", "description": "로컬 검색 쿼리"},
                                "count": {"type": "integer", "description": "결과 수", "default": 5},
                            },
                            "required": ["query"],
                        }),
                    },
                ],
                "guides": [
                    {
                        "client_name": "Claude Desktop",
                        "config_json": json.dumps({
                            "mcpServers": {
                                "brave-search": {
                                    "command": "npx",
                                    "args": ["-y", "@modelcontextprotocol/server-brave-search"],
                                    "env": {"BRAVE_API_KEY": "<your-api-key>"},
                                }
                            }
                        }, indent=2),
                        "instructions": "Brave Search API 키가 필요합니다.\nhttps://brave.com/search/api/ 에서 API 키를 발급받으세요.",
                    },
                ],
            },
        ]

        for server_data in servers_data:
            existing = db.query(McpServer).filter(McpServer.slug == server_data["slug"]).first()
            if existing:
                continue

            tools = server_data.pop("tools", [])
            guides = server_data.pop("guides", [])
            category_slug = server_data.pop("category_slug", None)

            server_data["category_id"] = cat_map.get(category_slug)

            server = McpServer(**server_data)
            db.add(server)
            db.flush()

            for tool_data in tools:
                tool = McpTool(server_id=server.id, **tool_data)
                db.add(tool)

            for guide_data in guides:
                guide = McpInstallGuide(server_id=server.id, **guide_data)
                db.add(guide)

        db.commit()
        print("Seed data created successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
