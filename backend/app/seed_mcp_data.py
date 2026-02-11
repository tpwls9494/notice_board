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


# --- Install Guide Templates ---

def make_claude_desktop_guide(server_key, package_name, args=None, env=None):
    """Claude Desktop 설치 가이드를 생성합니다."""
    config = {
        "mcpServers": {
            server_key: {
                "command": "npx",
                "args": ["-y", package_name] + (args or []),
            }
        }
    }
    if env:
        config["mcpServers"][server_key]["env"] = env

    instructions_parts = ["claude_desktop_config.json 파일에 위 설정을 추가하세요."]
    if args:
        instructions_parts.append("경로 또는 연결 문자열을 실제 값으로 변경하세요.")
    if env:
        env_names = ", ".join(env.keys())
        instructions_parts.append(f"{env_names} 값을 실제 발급받은 키/토큰으로 변경하세요.")

    return {
        "client_name": "Claude Desktop",
        "config_json": json.dumps(config, indent=2),
        "instructions": "\n".join(instructions_parts),
    }


def make_cursor_guide(server_key, package_name, args=None, env=None):
    """Cursor 설치 가이드를 생성합니다."""
    config = {
        "mcpServers": {
            server_key: {
                "command": "npx",
                "args": ["-y", package_name] + (args or []),
            }
        }
    }
    if env:
        config["mcpServers"][server_key]["env"] = env

    return {
        "client_name": "Cursor",
        "config_json": json.dumps(config, indent=2),
        "instructions": "Cursor Settings > MCP 탭에서 위 설정을 추가하세요.",
    }


def _tool(name, description, properties, required=None, sample_output=None):
    """도구 정의 헬퍼."""
    schema = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    result = {"name": name, "description": description, "input_schema": json.dumps(schema)}
    if sample_output is not None:
        result["sample_output"] = json.dumps(sample_output, ensure_ascii=False)
    return result


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

        # --- Servers (10개) ---
        servers_data = [
            # 1. Filesystem Server (기존)
            {
                "name": "Filesystem Server",
                "slug": "filesystem-server",
                "description": "MCP 서버로 로컬 파일 시스템에 접근합니다. 파일 읽기, 쓰기, 디렉토리 탐색 등의 기능을 제공합니다.",
                "short_description": "로컬 파일 시스템 접근을 위한 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir",
                "package_name": "@modelcontextprotocol/server-filesystem",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "filesystem",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "tools": [
                    _tool("read_file", "파일의 전체 내용을 읽습니다.", {"path": {"type": "string", "description": "읽을 파일의 경로"}}, ["path"],
                          sample_output={"content": [{"type": "text", "text": "# README.md\n\nWelcome to the project!\n\n## Getting Started\n\n1. Install dependencies: `npm install`\n2. Run the server: `npm start`\n3. Open http://localhost:3000"}]}),
                    _tool("write_file", "파일에 내용을 작성합니다. 파일이 존재하면 덮어씁니다.", {
                        "path": {"type": "string", "description": "작성할 파일 경로"},
                        "content": {"type": "string", "description": "파일에 작성할 내용"},
                    }, ["path", "content"],
                          sample_output={"content": [{"type": "text", "text": "Successfully wrote 128 bytes to /Users/username/Desktop/notes.txt"}]}),
                    _tool("list_directory", "디렉토리의 파일 및 하위 디렉토리 목록을 반환합니다.", {"path": {"type": "string", "description": "탐색할 디렉토리 경로"}}, ["path"],
                          sample_output={"content": [{"type": "text", "text": "[DIR]  src/\n[DIR]  node_modules/\n[DIR]  public/\n[FILE] package.json (1.2KB)\n[FILE] README.md (456B)\n[FILE] .gitignore (89B)\n[FILE] tsconfig.json (523B)"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("filesystem", "@modelcontextprotocol/server-filesystem", args=["/Users/username/Desktop"]),
                    make_cursor_guide("filesystem", "@modelcontextprotocol/server-filesystem", args=["/path/to/dir"]),
                ],
            },
            # 2. GitHub Server (기존)
            {
                "name": "GitHub Server",
                "slug": "github-server",
                "description": "GitHub API와 연동하여 리포지토리 관리, 이슈 생성, PR 관리 등의 기능을 제공하는 MCP 서버입니다.",
                "short_description": "GitHub API 연동 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-github",
                "package_name": "@modelcontextprotocol/server-github",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "dev-tools",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "tools": [
                    _tool("search_repositories", "GitHub 리포지토리를 검색합니다.", {"query": {"type": "string", "description": "검색 쿼리"}}, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Found 3 repositories:\n\n1. modelcontextprotocol/servers (TypeScript) - ★ 15,200\n   MCP servers and implementations\n\n2. anthropics/claude-code (Python) - ★ 8,430\n   Claude Code CLI tool\n\n3. langchain-ai/langchain (Python) - ★ 78,500\n   Building LLM applications"}]}),
                    _tool("get_file_contents", "리포지토리에서 파일 내용을 가져옵니다.", {
                        "owner": {"type": "string"}, "repo": {"type": "string"}, "path": {"type": "string"},
                    }, ["owner", "repo", "path"],
                          sample_output={"content": [{"type": "text", "text": "{\n  \"name\": \"@modelcontextprotocol/servers\",\n  \"version\": \"1.0.0\",\n  \"description\": \"MCP server implementations\",\n  \"license\": \"MIT\"\n}"}]}),
                    _tool("create_issue", "GitHub 이슈를 생성합니다.", {
                        "owner": {"type": "string"}, "repo": {"type": "string"},
                        "title": {"type": "string"}, "body": {"type": "string"},
                    }, ["owner", "repo", "title"],
                          sample_output={"content": [{"type": "text", "text": "Issue created successfully!\n\n#142: Bug: Connection timeout on large files\nURL: https://github.com/example/repo/issues/142\nStatus: open\nLabels: bug"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("github", "@modelcontextprotocol/server-github", env={"GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"}),
                    make_cursor_guide("github", "@modelcontextprotocol/server-github", env={"GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"}),
                ],
            },
            # 3. Brave Search Server (기존)
            {
                "name": "Brave Search Server",
                "slug": "brave-search-server",
                "description": "Brave Search API를 사용하여 웹 검색과 로컬 검색 기능을 제공하는 MCP 서버입니다. 실시간 웹 정보를 AI에게 제공합니다.",
                "short_description": "Brave Search API 기반 웹/로컬 검색 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-brave-search",
                "package_name": "@modelcontextprotocol/server-brave-search",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "web",
                "demo_video_url": None,
                "tools": [
                    _tool("brave_web_search", "Brave Search를 사용하여 웹 검색을 수행합니다.", {
                        "query": {"type": "string", "description": "검색 쿼리"},
                        "count": {"type": "integer", "description": "결과 수", "default": 10},
                    }, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Web search results for 'MCP protocol':\n\n1. Model Context Protocol - Official Site\n   https://modelcontextprotocol.io\n   The Model Context Protocol enables AI assistants to connect with external data sources.\n\n2. MCP Servers - GitHub\n   https://github.com/modelcontextprotocol/servers\n   Official MCP server implementations for various services.\n\n3. Getting Started with MCP - Blog\n   https://blog.example.com/mcp-getting-started\n   A comprehensive guide to using MCP with Claude Desktop."}]}),
                    _tool("brave_local_search", "Brave를 사용하여 로컬 비즈니스 및 장소를 검색합니다.", {
                        "query": {"type": "string", "description": "로컬 검색 쿼리"},
                        "count": {"type": "integer", "description": "결과 수", "default": 5},
                    }, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Local results for '강남 카페':\n\n1. 블루보틀 강남점 ★4.5 (312 reviews)\n   서울 강남구 역삼동 123-4 | 영업중 09:00-22:00\n\n2. 스타벅스 강남대로점 ★4.2 (1,024 reviews)\n   서울 강남구 강남대로 456 | 영업중 07:00-23:00"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("brave-search", "@modelcontextprotocol/server-brave-search", env={"BRAVE_API_KEY": "<your-api-key>"}),
                    make_cursor_guide("brave-search", "@modelcontextprotocol/server-brave-search", env={"BRAVE_API_KEY": "<your-api-key>"}),
                ],
            },
            # 4. Slack Server (신규)
            {
                "name": "Slack Server",
                "slug": "slack-server",
                "description": "Slack API와 연동하여 채널 목록 조회, 메시지 전송, 채널 히스토리 조회 등의 기능을 제공하는 MCP 서버입니다. 팀 커뮤니케이션을 AI로 자동화할 수 있습니다.",
                "short_description": "Slack 워크스페이스 연동 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-slack",
                "package_name": "@modelcontextprotocol/server-slack",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "productivity",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "tools": [
                    _tool("list_channels", "워크스페이스의 모든 Slack 채널 목록을 조회합니다.", {
                        "limit": {"type": "integer", "description": "조회할 채널 수", "default": 100},
                    }, sample_output={"content": [{"type": "text", "text": "Channels (5):\n\n#general (C01ABC123) - 42 members\n#random (C01DEF456) - 38 members\n#engineering (C02GHI789) - 15 members\n#design (C03JKL012) - 8 members\n#announcements (C04MNO345) - 42 members"}]}),
                    _tool("post_message", "특정 채널에 메시지를 전송합니다.", {
                        "channel_id": {"type": "string", "description": "채널 ID"},
                        "text": {"type": "string", "description": "전송할 메시지"},
                    }, ["channel_id", "text"],
                          sample_output={"content": [{"type": "text", "text": "Message sent successfully!\n\nChannel: #general\nTimestamp: 1707123456.789012\nMessage: Hello from MCP!"}]}),
                    _tool("get_channel_history", "채널의 메시지 히스토리를 조회합니다.", {
                        "channel_id": {"type": "string", "description": "채널 ID"},
                        "limit": {"type": "integer", "description": "조회할 메시지 수", "default": 10},
                    }, ["channel_id"],
                          sample_output={"content": [{"type": "text", "text": "Recent messages in #general:\n\n[10:30] @alice: 오늘 배포 일정 확인해주세요\n[10:25] @bob: PR #234 리뷰 완료했습니다\n[10:15] @charlie: 점심 메뉴 투표 올렸어요\n[09:50] @alice: 좋은 아침입니다!"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("slack", "@modelcontextprotocol/server-slack", env={
                        "SLACK_BOT_TOKEN": "<xoxb-your-bot-token>",
                        "SLACK_TEAM_ID": "<your-team-id>",
                    }),
                    make_cursor_guide("slack", "@modelcontextprotocol/server-slack", env={
                        "SLACK_BOT_TOKEN": "<xoxb-your-bot-token>",
                        "SLACK_TEAM_ID": "<your-team-id>",
                    }),
                ],
            },
            # 5. Google Drive Server (신규)
            {
                "name": "Google Drive Server",
                "slug": "google-drive-server",
                "description": "Google Drive API와 연동하여 파일 검색, 문서 읽기 등의 기능을 제공하는 MCP 서버입니다. Google Workspace 문서에 AI로 접근할 수 있습니다.",
                "short_description": "Google Drive 파일 접근 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-gdrive",
                "package_name": "@modelcontextprotocol/server-gdrive",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "productivity",
                "demo_video_url": None,
                "tools": [
                    _tool("search_files", "Google Drive에서 파일을 검색합니다.", {
                        "query": {"type": "string", "description": "검색 쿼리"},
                    }, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Found 3 files:\n\n1. 2024 Q4 보고서.docx (Google Docs)\n   Modified: 2024-01-15 | Owner: kim@company.com\n\n2. 프로젝트 일정표.xlsx (Google Sheets)\n   Modified: 2024-01-10 | Owner: lee@company.com\n\n3. 회의록_20240112.pdf\n   Modified: 2024-01-12 | Owner: park@company.com"}]}),
                    _tool("read_file", "Google Drive 파일의 내용을 읽습니다.", {
                        "file_id": {"type": "string", "description": "Google Drive 파일 ID"},
                    }, ["file_id"],
                          sample_output={"content": [{"type": "text", "text": "# 2024 Q4 보고서\n\n## 요약\n- 매출: 전분기 대비 15% 성장\n- 신규 고객: 234명 확보\n- 주요 성과: MCP 마켓플레이스 런칭\n\n## 다음 분기 계획\n- 사용자 피드백 반영 개선\n- 신규 MCP 서버 10개 추가"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("gdrive", "@modelcontextprotocol/server-gdrive"),
                ],
            },
            # 6. PostgreSQL Server (신규)
            {
                "name": "PostgreSQL Server",
                "slug": "postgresql-server",
                "description": "PostgreSQL 데이터베이스에 직접 연결하여 쿼리를 실행하고, 스키마를 조회하고, 데이터를 분석할 수 있는 MCP 서버입니다. 읽기 전용 모드로 안전하게 데이터베이스를 탐색합니다.",
                "short_description": "PostgreSQL 데이터베이스 연결 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-postgres postgresql://localhost/mydb",
                "package_name": "@modelcontextprotocol/server-postgres",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "data",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "tools": [
                    _tool("query", "PostgreSQL 데이터베이스에서 읽기 전용 쿼리를 실행합니다.", {
                        "sql": {"type": "string", "description": "실행할 SQL 쿼리"},
                    }, ["sql"],
                          sample_output={"content": [{"type": "text", "text": "Query results (3 rows):\n\n| id | name       | email              | created_at          |\n|----|------------|--------------------|---------------------|\n| 1  | Alice Kim  | alice@example.com  | 2024-01-15 09:30:00 |\n| 2  | Bob Lee    | bob@example.com    | 2024-01-14 14:22:00 |\n| 3  | Charlie Jo | charlie@example.com| 2024-01-13 11:45:00 |"}]}),
                    _tool("list_tables", "데이터베이스의 모든 테이블 목록을 조회합니다.", {},
                          sample_output={"content": [{"type": "text", "text": "Tables in database:\n\n1. users (1,234 rows)\n2. posts (5,678 rows)\n3. comments (12,345 rows)\n4. categories (6 rows)\n5. likes (8,901 rows)\n6. files (234 rows)"}]}),
                    _tool("describe_table", "테이블의 스키마(컬럼, 타입, 제약조건)를 조회합니다.", {
                        "table_name": {"type": "string", "description": "조회할 테이블 이름"},
                    }, ["table_name"],
                          sample_output={"content": [{"type": "text", "text": "Table: users\n\n| Column      | Type         | Nullable | Default      |\n|-------------|--------------|----------|-------------|\n| id          | integer      | NO       | nextval()   |\n| email       | varchar(255) | NO       |             |\n| username    | varchar(50)  | NO       |             |\n| password    | varchar(255) | NO       |             |\n| is_admin    | boolean      | NO       | false       |\n| created_at  | timestamptz  | NO       | now()       |\n\nIndexes: pk_users (id), idx_users_email (email UNIQUE)"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("postgres", "@modelcontextprotocol/server-postgres", args=["postgresql://localhost/mydb"]),
                    make_cursor_guide("postgres", "@modelcontextprotocol/server-postgres", args=["postgresql://localhost/mydb"]),
                ],
            },
            # 7. Memory Server (신규)
            {
                "name": "Memory Server",
                "slug": "memory-server",
                "description": "지식 그래프 기반의 영구 메모리 시스템을 제공하는 MCP 서버입니다. 엔티티와 관계를 저장하여 대화 간 컨텍스트를 유지할 수 있습니다.",
                "short_description": "지식 그래프 기반 영구 메모리 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-memory",
                "package_name": "@modelcontextprotocol/server-memory",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "ai-ml",
                "demo_video_url": None,
                "tools": [
                    _tool("create_entities", "지식 그래프에 새 엔티티를 생성합니다.", {
                        "entities": {"type": "array", "description": "생성할 엔티티 목록", "items": {
                            "type": "object", "properties": {
                                "name": {"type": "string"}, "entityType": {"type": "string"},
                                "observations": {"type": "array", "items": {"type": "string"}},
                            },
                        }},
                    }, ["entities"],
                          sample_output={"content": [{"type": "text", "text": "Created 2 entities:\n\n1. [Person] Alice Kim\n   - Observations: \"Backend developer\", \"Likes Python\"\n\n2. [Project] MCP Marketplace\n   - Observations: \"FastAPI + React\", \"Started Jan 2024\""}]}),
                    _tool("search_nodes", "지식 그래프에서 엔티티를 검색합니다.", {
                        "query": {"type": "string", "description": "검색 쿼리"},
                    }, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Search results for 'developer':\n\n1. [Person] Alice Kim\n   Observations: Backend developer, Likes Python, Team Lead\n\n2. [Person] Bob Lee\n   Observations: Frontend developer, React specialist"}]}),
                    _tool("open_nodes", "특정 엔티티의 상세 정보와 관계를 조회합니다.", {
                        "names": {"type": "array", "description": "조회할 엔티티 이름 목록", "items": {"type": "string"}},
                    }, ["names"],
                          sample_output={"content": [{"type": "text", "text": "Entity: Alice Kim [Person]\n\nObservations:\n- Backend developer\n- Likes Python\n- Team Lead\n\nRelations:\n- WORKS_ON → MCP Marketplace\n- MENTORS → Bob Lee\n- MEMBER_OF → Engineering Team"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("memory", "@modelcontextprotocol/server-memory"),
                    make_cursor_guide("memory", "@modelcontextprotocol/server-memory"),
                ],
            },
            # 8. Puppeteer Server (신규)
            {
                "name": "Puppeteer Server",
                "slug": "puppeteer-server",
                "description": "Puppeteer를 사용하여 웹 브라우저를 제어하는 MCP 서버입니다. 웹 페이지 탐색, 스크린샷 캡처, 폼 입력, 클릭 등의 브라우저 자동화 기능을 제공합니다.",
                "short_description": "Puppeteer 기반 브라우저 자동화 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-puppeteer",
                "package_name": "@modelcontextprotocol/server-puppeteer",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "web",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "tools": [
                    _tool("navigate", "지정된 URL로 브라우저를 이동합니다.", {
                        "url": {"type": "string", "description": "이동할 URL"},
                    }, ["url"],
                          sample_output={"content": [{"type": "text", "text": "Navigated to https://example.com\n\nPage title: Example Domain\nStatus: 200 OK\nLoad time: 342ms"}]}),
                    _tool("screenshot", "현재 페이지의 스크린샷을 캡처합니다.", {
                        "name": {"type": "string", "description": "스크린샷 파일 이름"},
                        "width": {"type": "integer", "description": "화면 너비", "default": 1280},
                        "height": {"type": "integer", "description": "화면 높이", "default": 720},
                    }, ["name"],
                          sample_output={"content": [{"type": "text", "text": "Screenshot saved: homepage.png\n\nDimensions: 1280x720\nFormat: PNG\nFile size: 245KB"}]}),
                    _tool("click", "페이지에서 요소를 클릭합니다.", {
                        "selector": {"type": "string", "description": "클릭할 CSS 선택자"},
                    }, ["selector"],
                          sample_output={"content": [{"type": "text", "text": "Clicked element: button.submit-btn\n\nElement text: \"Submit\"\nNavigation triggered: true\nNew URL: https://example.com/success"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("puppeteer", "@modelcontextprotocol/server-puppeteer"),
                    make_cursor_guide("puppeteer", "@modelcontextprotocol/server-puppeteer"),
                ],
            },
            # 9. SQLite Server (신규)
            {
                "name": "SQLite Server",
                "slug": "sqlite-server",
                "description": "SQLite 데이터베이스에 연결하여 쿼리 실행, 테이블 관리, 데이터 분석을 할 수 있는 MCP 서버입니다. 로컬 SQLite 파일을 AI로 직접 다룰 수 있습니다.",
                "short_description": "SQLite 데이터베이스 연결 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-sqlite /path/to/database.db",
                "package_name": "@modelcontextprotocol/server-sqlite",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "data",
                "demo_video_url": None,
                "tools": [
                    _tool("read_query", "SQLite 데이터베이스에서 SELECT 쿼리를 실행합니다.", {
                        "query": {"type": "string", "description": "실행할 SELECT 쿼리"},
                    }, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Query results (2 rows):\n\n| id | title              | status  | priority |\n|----|--------------------|---------|----------|\n| 1  | Fix login bug      | done    | high     |\n| 2  | Add dark mode      | pending | medium   |"}]}),
                    _tool("write_query", "SQLite 데이터베이스에서 INSERT/UPDATE/DELETE 쿼리를 실행합니다.", {
                        "query": {"type": "string", "description": "실행할 쿼리"},
                    }, ["query"],
                          sample_output={"content": [{"type": "text", "text": "Query executed successfully.\n\nRows affected: 1\nOperation: INSERT\nTable: tasks"}]}),
                    _tool("list_tables", "데이터베이스의 모든 테이블 목록을 조회합니다.", {},
                          sample_output={"content": [{"type": "text", "text": "Tables in database:\n\n1. tasks (45 rows)\n2. users (12 rows)\n3. tags (8 rows)\n4. task_tags (67 rows)"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("sqlite", "@modelcontextprotocol/server-sqlite", args=["/path/to/database.db"]),
                    make_cursor_guide("sqlite", "@modelcontextprotocol/server-sqlite", args=["/path/to/database.db"]),
                ],
            },
            # 10. Fetch Server (신규)
            {
                "name": "Fetch Server",
                "slug": "fetch-server",
                "description": "웹 페이지와 API에서 콘텐츠를 가져오는 MCP 서버입니다. URL에서 HTML, JSON, 텍스트 등 다양한 형식의 데이터를 효율적으로 추출합니다.",
                "short_description": "웹 콘텐츠 가져오기 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 0,
                "install_command": "npx -y @modelcontextprotocol/server-fetch",
                "package_name": "@modelcontextprotocol/server-fetch",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "web",
                "demo_video_url": None,
                "tools": [
                    _tool("fetch", "URL에서 콘텐츠를 가져옵니다. HTML은 마크다운으로 변환됩니다.", {
                        "url": {"type": "string", "description": "가져올 URL"},
                        "max_length": {"type": "integer", "description": "최대 콘텐츠 길이", "default": 5000},
                        "raw": {"type": "boolean", "description": "변환 없이 원본 반환", "default": False},
                    }, ["url"],
                          sample_output={"content": [{"type": "text", "text": "Fetched: https://example.com (200 OK, 1,234 chars)\n\n# Example Domain\n\nThis domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\n[More information...](https://www.iana.org/domains/example)"}]}),
                ],
                "guides": [
                    make_claude_desktop_guide("fetch", "@modelcontextprotocol/server-fetch"),
                    make_cursor_guide("fetch", "@modelcontextprotocol/server-fetch"),
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
        print("Seed data created successfully! (10 MCP servers)")

    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
