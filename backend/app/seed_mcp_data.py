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
# Import all models to ensure SQLAlchemy can resolve relationships
from app.models.user import User  # noqa: F401
from app.models.post import Post  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.comment import Comment  # noqa: F401
from app.models.like import Like  # noqa: F401
from app.models.file import File  # noqa: F401
from app.models.bookmark import Bookmark  # noqa: F401
from app.models.notification import Notification  # noqa: F401


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


def _showcase(highlights, use_cases, scenarios):
    """showcase_data JSON 헬퍼."""
    return json.dumps({"highlights": highlights, "use_cases": use_cases, "scenarios": scenarios}, ensure_ascii=False)


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
            # 1. Filesystem Server
            {
                "name": "Filesystem Server",
                "slug": "filesystem-server",
                "description": "AI가 여러분의 로컬 파일 시스템에 직접 접근하여 파일을 읽고, 수정하고, 디렉토리를 탐색합니다. 코드 분석부터 설정 파일 생성까지, 파일과 관련된 모든 작업을 대화만으로 처리할 수 있습니다. 더 이상 파일을 일일이 열어볼 필요가 없습니다.",
                "short_description": "AI가 직접 파일을 읽고 수정하는 파일 시스템 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir",
                "package_name": "@modelcontextprotocol/server-filesystem",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "filesystem",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "folder-search", "title": "프로젝트 구조 즉시 파악", "description": "AI가 디렉토리를 탐색하고 파일 구조를 분석하여 프로젝트 전체 그림을 한눈에 보여줍니다."},
                        {"icon": "edit", "title": "코드 직접 수정", "description": "버그 수정, 리팩토링, 새 기능 추가 시 AI가 직접 파일을 수정하여 코딩 시간을 절약합니다."},
                        {"icon": "zap", "title": "반복 작업 자동화", "description": "설정 파일 생성, 보일러플레이트 코드 작성 등 반복적인 파일 작업을 AI에 맡기세요."},
                    ],
                    use_cases=[
                        {"persona": "백엔드 개발자", "scenario": "새 프로젝트 초기 셋업 시 디렉토리 구조 생성부터 설정 파일 작성까지 AI에게 요청", "benefit": "30분 → 2분"},
                        {"persona": "학생/입문자", "scenario": "처음 보는 오픈소스 프로젝트의 파일 구조를 AI가 탐색하고 코드를 설명", "benefit": "코드베이스 빠른 이해"},
                        {"persona": "데브옵스 엔지니어", "scenario": "서버 로그 파일을 AI가 읽고 에러 패턴을 분석하여 원인 파악", "benefit": "수동 로그 분석 불필요"},
                    ],
                    scenarios=[
                        {
                            "title": "새 프로젝트 코드 분석하기",
                            "description": "처음 접하는 프로젝트의 구조를 파악하고 핵심 파일을 이해하는 시나리오",
                            "steps": [
                                {"tool_name": "list_directory", "sample_args": {"path": "/Users/dev/my-project"}, "narration": "먼저 프로젝트의 전체 구조를 확인합니다."},
                                {"tool_name": "read_file", "sample_args": {"path": "/Users/dev/my-project/README.md"}, "narration": "README를 읽어 프로젝트가 무엇인지 파악합니다."},
                                {"tool_name": "read_file", "sample_args": {"path": "/Users/dev/my-project/package.json"}, "narration": "의존성과 스크립트를 확인하여 기술 스택을 이해합니다."},
                            ],
                        },
                    ],
                ),
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
            # 2. GitHub Server
            {
                "name": "GitHub Server",
                "slug": "github-server",
                "description": "AI와 대화하면서 GitHub의 모든 작업을 처리합니다. 리포지토리 검색, 코드 확인, 이슈 생성, PR 관리까지 — 브라우저를 열지 않고도 GitHub 워크플로우를 완벽하게 자동화할 수 있습니다. 오픈소스 기여와 팀 협업이 훨씬 빨라집니다.",
                "short_description": "대화로 GitHub 워크플로우를 자동화하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-github",
                "package_name": "@modelcontextprotocol/server-github",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "dev-tools",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "edit", "title": "대화로 이슈 관리", "description": "이슈 생성, 라벨 지정, 담당자 배정을 대화만으로 처리합니다. 복잡한 GitHub UI를 탐색할 필요가 없습니다."},
                        {"icon": "globe", "title": "코드 리뷰 자동화", "description": "PR 내용을 AI가 분석하고, 파일 변경사항을 확인하여 리뷰 포인트를 정리합니다."},
                        {"icon": "folder-search", "title": "오픈소스 탐색", "description": "전 세계 GitHub 리포지토리를 자연어로 검색하고, 코드 내용까지 바로 확인합니다."},
                    ],
                    use_cases=[
                        {"persona": "오픈소스 관리자", "scenario": "새로 등록된 이슈를 AI가 분류하고 적절한 라벨과 담당자를 자동 배정", "benefit": "이슈 정리 시간 80% 절약"},
                        {"persona": "팀 리드", "scenario": "팀원의 PR을 AI가 먼저 리뷰하여 코드 변경 요약과 잠재적 이슈 사전 파악", "benefit": "리뷰 시간 절반으로"},
                        {"persona": "개발자", "scenario": "특정 기능 구현 레퍼런스를 GitHub에서 검색하고 코드를 직접 확인", "benefit": "빠른 레퍼런스 발견"},
                    ],
                    scenarios=[
                        {
                            "title": "버그 리포트 이슈 생성하기",
                            "description": "코드를 확인한 뒤 버그 이슈를 생성하는 워크플로우",
                            "steps": [
                                {"tool_name": "search_repositories", "sample_args": {"query": "modelcontextprotocol servers"}, "narration": "먼저 관련 리포지토리를 검색합니다."},
                                {"tool_name": "get_file_contents", "sample_args": {"owner": "modelcontextprotocol", "repo": "servers", "path": "package.json"}, "narration": "프로젝트 정보를 확인합니다."},
                                {"tool_name": "create_issue", "sample_args": {"owner": "modelcontextprotocol", "repo": "servers", "title": "Bug: Connection timeout on large files", "body": "Large files over 10MB cause timeout..."}, "narration": "확인된 버그를 이슈로 등록합니다."},
                            ],
                        },
                    ],
                ),
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
            # 3. Brave Search Server
            {
                "name": "Brave Search Server",
                "slug": "brave-search-server",
                "description": "AI에게 실시간 웹 검색 능력을 부여합니다. Brave Search API를 통해 최신 정보를 검색하고, 주변 맛집이나 카페 같은 로컬 비즈니스도 찾아줍니다. AI가 학습 데이터에 없는 최신 정보까지 활용하여 더 정확하고 유용한 답변을 제공합니다.",
                "short_description": "AI에게 실시간 웹 검색 능력을 부여하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-brave-search",
                "package_name": "@modelcontextprotocol/server-brave-search",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "web",
                "demo_video_url": None,
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "globe", "title": "실시간 최신 정보", "description": "AI의 학습 데이터 이후에 나온 최신 정보도 웹 검색으로 찾아 답변에 활용합니다."},
                        {"icon": "users", "title": "로컬 비즈니스 검색", "description": "주변 맛집, 카페, 병원 등 위치 기반 검색으로 평점과 영업시간까지 한번에 확인합니다."},
                        {"icon": "shield", "title": "프라이버시 보호", "description": "Brave의 프라이버시 중심 검색 엔진을 사용하여 개인정보를 보호합니다."},
                    ],
                    use_cases=[
                        {"persona": "개발자", "scenario": "새로 나온 라이브러리의 최신 API 문서와 사용법을 AI가 검색하여 정리", "benefit": "구글링 시간 절약"},
                        {"persona": "기획자", "scenario": "경쟁사 분석이나 시장 트렌드를 AI가 검색하고 핵심만 요약", "benefit": "리서치 자동화"},
                        {"persona": "일반 사용자", "scenario": "\"강남역 근처 분위기 좋은 카페\"를 검색하면 평점, 리뷰, 영업시간까지 한눈에", "benefit": "맛집/카페 찾기 간편"},
                    ],
                    scenarios=[
                        {
                            "title": "최신 기술 트렌드 조사하기",
                            "description": "AI가 웹 검색으로 최신 기술 정보를 수집하고 정리하는 시나리오",
                            "steps": [
                                {"tool_name": "brave_web_search", "sample_args": {"query": "MCP protocol 2025 latest updates", "count": 5}, "narration": "먼저 최신 MCP 관련 뉴스를 검색합니다."},
                                {"tool_name": "brave_local_search", "sample_args": {"query": "강남 카페", "count": 3}, "narration": "리서치 중 커피가 필요할 때, 주변 카페도 찾아볼 수 있습니다."},
                            ],
                        },
                    ],
                ),
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
            # 4. Slack Server
            {
                "name": "Slack Server",
                "slug": "slack-server",
                "description": "AI가 Slack 워크스페이스에 직접 접근하여 채널 관리, 메시지 전송, 대화 히스토리 조회를 수행합니다. 놓친 대화를 AI가 요약해주고, 정기 보고나 알림 메시지도 자동으로 보낼 수 있어 팀 커뮤니케이션이 훨씬 효율적으로 변합니다.",
                "short_description": "AI로 Slack 팀 커뮤니케이션을 자동화하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-slack",
                "package_name": "@modelcontextprotocol/server-slack",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "productivity",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "zap", "title": "놓친 대화 즉시 파악", "description": "채널 히스토리를 AI가 읽고 핵심 내용을 요약하여, 회의나 외출 후에도 빠르게 상황을 파악합니다."},
                        {"icon": "edit", "title": "메시지 자동 전송", "description": "배포 알림, 일일 보고, 팀 공지 등 반복적인 메시지를 AI가 작성하고 전송합니다."},
                        {"icon": "users", "title": "채널 관리 간편화", "description": "워크스페이스의 모든 채널을 한눈에 파악하고, 필요한 채널에 바로 접근합니다."},
                    ],
                    use_cases=[
                        {"persona": "팀 매니저", "scenario": "오전에 AI에게 \"어제 저녁 이후 주요 대화 요약해줘\"라고 요청하면 채널별 핵심 내용 정리", "benefit": "스크롤 없이 상황 파악"},
                        {"persona": "개발자", "scenario": "배포 완료 후 AI가 자동으로 #engineering 채널에 배포 내역 메시지 전송", "benefit": "수동 알림 불필요"},
                        {"persona": "마케터", "scenario": "캠페인 결과를 AI가 정리하여 관련 채널에 맞춤 보고 메시지 전송", "benefit": "채널별 맞춤 보고"},
                    ],
                    scenarios=[
                        {
                            "title": "팀 커뮤니케이션 현황 파악하기",
                            "description": "채널을 탐색하고, 최근 대화를 확인한 후 메시지를 보내는 워크플로우",
                            "steps": [
                                {"tool_name": "list_channels", "sample_args": {"limit": 10}, "narration": "먼저 워크스페이스의 채널 목록을 확인합니다."},
                                {"tool_name": "get_channel_history", "sample_args": {"channel_id": "C01ABC123", "limit": 5}, "narration": "#general 채널의 최근 대화를 가져옵니다."},
                                {"tool_name": "post_message", "sample_args": {"channel_id": "C01ABC123", "text": "오전 스탠드업 요약: 배포 일정 확인 필요, PR #234 리뷰 완료"}, "narration": "대화 내용을 요약하여 메시지를 전송합니다."},
                            ],
                        },
                    ],
                ),
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
            # 5. Google Drive Server
            {
                "name": "Google Drive Server",
                "slug": "google-drive-server",
                "description": "AI가 Google Drive에 직접 접근하여 파일을 검색하고 문서 내용을 읽어줍니다. 수십 개의 폴더를 뒤질 필요 없이 \"지난달 회의록 찾아줘\"라고 말하면 됩니다. Google Docs, Sheets, PDF 등 모든 포맷을 지원하여 문서 기반 업무가 획기적으로 빨라집니다.",
                "short_description": "AI로 Google Drive 문서를 검색하고 분석하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-gdrive",
                "package_name": "@modelcontextprotocol/server-gdrive",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "productivity",
                "demo_video_url": None,
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "folder-search", "title": "자연어 문서 검색", "description": "\"지난달 마케팅 보고서 찾아줘\"라고 말하면 AI가 Google Drive에서 관련 파일을 찾아줍니다."},
                        {"icon": "edit", "title": "문서 내용 분석", "description": "보고서, 스프레드시트 내용을 AI가 읽고 핵심 내용을 요약하거나 질문에 답변합니다."},
                        {"icon": "zap", "title": "Google Workspace 통합", "description": "Docs, Sheets, Slides, PDF 등 모든 Google Workspace 파일 포맷을 지원합니다."},
                    ],
                    use_cases=[
                        {"persona": "기획자", "scenario": "과거 프로젝트 보고서를 검색하고 AI가 핵심 내용을 요약하여 새 기획에 참고", "benefit": "파일 뒤지기 불필요"},
                        {"persona": "경영진", "scenario": "주간/월간 보고서를 AI가 읽고 핵심 지표와 변동사항만 빠르게 브리핑", "benefit": "5분 브리핑"},
                    ],
                    scenarios=[
                        {
                            "title": "보고서 찾아서 분석하기",
                            "description": "필요한 문서를 검색하고 내용을 파악하는 시나리오",
                            "steps": [
                                {"tool_name": "search_files", "sample_args": {"query": "2024 Q4 보고서"}, "narration": "먼저 \"2024 Q4 보고서\"를 키워드로 검색합니다."},
                                {"tool_name": "read_file", "sample_args": {"file_id": "1A2B3C4D5E"}, "narration": "검색된 보고서의 내용을 읽어 핵심 지표를 파악합니다."},
                            ],
                        },
                    ],
                ),
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
            # 6. PostgreSQL Server
            {
                "name": "PostgreSQL Server",
                "slug": "postgresql-server",
                "description": "AI가 PostgreSQL 데이터베이스에 직접 연결하여 자연어로 데이터를 조회하고 분석합니다. \"지난달 신규 가입자 수 알려줘\"라고 말하면 AI가 적절한 SQL을 작성하고 실행합니다. 읽기 전용 모드로 안전하게 운영하여 데이터 변경 걱정 없이 사용할 수 있습니다.",
                "short_description": "자연어로 PostgreSQL 데이터를 조회하고 분석하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-postgres postgresql://localhost/mydb",
                "package_name": "@modelcontextprotocol/server-postgres",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "data",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "database", "title": "자연어로 SQL 실행", "description": "\"이번 달 매출 TOP 10 상품 보여줘\"라고 말하면 AI가 SQL을 생성하고 결과를 보여줍니다."},
                        {"icon": "shield", "title": "읽기 전용 안전 모드", "description": "SELECT 쿼리만 실행 가능한 읽기 전용 모드로 데이터 변경 위험 없이 안전하게 탐색합니다."},
                        {"icon": "folder-search", "title": "스키마 자동 파악", "description": "테이블 구조와 관계를 AI가 자동으로 파악하여 정확한 쿼리를 생성합니다."},
                    ],
                    use_cases=[
                        {"persona": "데이터 분석가", "scenario": "복잡한 SQL 대신 \"월별 사용자 증가 추이\"라고 자연어로 질문하여 데이터 확인", "benefit": "쿼리 작성 90% 절약"},
                        {"persona": "백엔드 개발자", "scenario": "새로 맡은 프로젝트의 DB 구조를 AI가 탐색하고 테이블 관계를 설명", "benefit": "DB 구조 빠른 이해"},
                        {"persona": "PM/기획자", "scenario": "서비스 지표를 개발팀에 요청하지 않고 AI를 통해 직접 데이터베이스에서 확인", "benefit": "개발팀 요청 불필요"},
                    ],
                    scenarios=[
                        {
                            "title": "데이터베이스 탐색 및 분석",
                            "description": "DB 구조를 파악하고 데이터를 조회하여 인사이트를 얻는 시나리오",
                            "steps": [
                                {"tool_name": "list_tables", "sample_args": {}, "narration": "먼저 어떤 테이블들이 있는지 확인합니다."},
                                {"tool_name": "describe_table", "sample_args": {"table_name": "users"}, "narration": "users 테이블의 구조를 파악합니다."},
                                {"tool_name": "query", "sample_args": {"sql": "SELECT date_trunc('month', created_at) as month, COUNT(*) as signups FROM users GROUP BY 1 ORDER BY 1 DESC LIMIT 6"}, "narration": "최근 6개월 월별 가입자 수를 조회합니다."},
                            ],
                        },
                    ],
                ),
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
            # 7. Memory Server
            {
                "name": "Memory Server",
                "slug": "memory-server",
                "description": "AI에게 장기 기억 능력을 부여하는 지식 그래프 기반 메모리 시스템입니다. 사람, 프로젝트, 아이디어 등의 정보와 그들 간의 관계를 저장하여, 대화가 바뀌어도 이전 맥락을 기억합니다. AI가 매번 같은 질문을 하지 않고 여러분에 대해 점점 더 잘 이해하게 됩니다.",
                "short_description": "AI에게 장기 기억을 부여하는 지식 그래프 메모리 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-memory",
                "package_name": "@modelcontextprotocol/server-memory",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "ai-ml",
                "demo_video_url": None,
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "database", "title": "대화 간 기억 유지", "description": "새 대화를 시작해도 이전에 알려준 정보(선호도, 프로젝트, 팀 구성)를 AI가 기억합니다."},
                        {"icon": "globe", "title": "지식 그래프 구축", "description": "사람, 프로젝트, 기술 등의 엔티티와 관계를 체계적으로 저장하고 검색합니다."},
                        {"icon": "users", "title": "개인화된 AI 경험", "description": "사용할수록 AI가 여러분의 업무 컨텍스트를 더 잘 이해하고 맞춤 답변을 제공합니다."},
                    ],
                    use_cases=[
                        {"persona": "프리랜서", "scenario": "고객별 선호사항, 프로젝트 히스토리를 저장하여 매번 설명하지 않아도 AI가 맥락을 파악", "benefit": "고객 관리 자동화"},
                        {"persona": "연구자", "scenario": "논문, 아이디어, 실험 결과 간의 관계를 지식 그래프로 관리하여 연구 흐름 체계화", "benefit": "지식 체계적 관리"},
                    ],
                    scenarios=[
                        {
                            "title": "팀 정보 기억시키기",
                            "description": "팀원 정보를 저장하고 나중에 검색하는 시나리오",
                            "steps": [
                                {"tool_name": "create_entities", "sample_args": {"entities": [{"name": "Alice Kim", "entityType": "Person", "observations": ["Backend developer", "Likes Python", "Team Lead"]}]}, "narration": "팀원 정보를 엔티티로 저장합니다."},
                                {"tool_name": "search_nodes", "sample_args": {"query": "developer"}, "narration": "나중에 \"개발자\" 키워드로 관련 팀원을 검색할 수 있습니다."},
                                {"tool_name": "open_nodes", "sample_args": {"names": ["Alice Kim"]}, "narration": "특정 팀원의 상세 정보와 다른 엔티티와의 관계를 확인합니다."},
                            ],
                        },
                    ],
                ),
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
            # 8. Puppeteer Server
            {
                "name": "Puppeteer Server",
                "slug": "puppeteer-server",
                "description": "AI가 실제 웹 브라우저를 조작하여 페이지 탐색, 스크린샷 캡처, 폼 입력, 버튼 클릭 등을 수행합니다. 반복적인 웹 작업을 자동화하고, 웹 페이지의 현재 상태를 시각적으로 확인할 수 있습니다. QA 테스트부터 데이터 수집까지 브라우저가 필요한 모든 작업을 대화로 처리합니다.",
                "short_description": "AI가 웹 브라우저를 직접 조작하는 자동화 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-puppeteer",
                "package_name": "@modelcontextprotocol/server-puppeteer",
                "is_featured": True,
                "is_verified": True,
                "category_slug": "web",
                "demo_video_url": "https://www.youtube.com/embed/MYXBnSMnMNI",
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "globe", "title": "웹 브라우저 완전 제어", "description": "페이지 이동, 클릭, 스크롤, 입력 등 사람이 하는 모든 브라우저 조작을 AI가 대신합니다."},
                        {"icon": "folder-search", "title": "스크린샷으로 시각 확인", "description": "웹 페이지의 현재 상태를 스크린샷으로 캡처하여 AI가 시각적으로 분석합니다."},
                        {"icon": "zap", "title": "반복 작업 자동화", "description": "로그인, 폼 작성, 데이터 입력 등 반복적인 브라우저 작업을 자동화합니다."},
                    ],
                    use_cases=[
                        {"persona": "QA 엔지니어", "scenario": "웹 UI 시나리오 테스트를 AI가 자동 수행하고 스크린샷으로 결과 확인", "benefit": "수동 테스트 80% 절약"},
                        {"persona": "프론트엔드 개발자", "scenario": "개발 중인 페이지를 AI가 탐색하고 다양한 해상도에서 스크린샷 캡처", "benefit": "수동 확인 불필요"},
                        {"persona": "마케터", "scenario": "경쟁사 웹사이트를 정기적으로 캡처하여 디자인/가격 변경 사항 모니터링", "benefit": "변경 감지 자동화"},
                    ],
                    scenarios=[
                        {
                            "title": "웹 페이지 탐색 및 테스트",
                            "description": "웹 페이지에 접속하여 UI를 확인하고 인터랙션을 수행하는 시나리오",
                            "steps": [
                                {"tool_name": "navigate", "sample_args": {"url": "https://example.com"}, "narration": "테스트할 웹 페이지로 이동합니다."},
                                {"tool_name": "screenshot", "sample_args": {"name": "homepage", "width": 1280, "height": 720}, "narration": "현재 페이지의 스크린샷을 캡처합니다."},
                                {"tool_name": "click", "sample_args": {"selector": "button.submit-btn"}, "narration": "Submit 버튼을 클릭하여 폼을 제출합니다."},
                            ],
                        },
                    ],
                ),
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
            # 9. SQLite Server
            {
                "name": "SQLite Server",
                "slug": "sqlite-server",
                "description": "로컬 SQLite 데이터베이스를 AI와 대화하며 관리합니다. 테이블 생성부터 데이터 입력, 복잡한 분석 쿼리까지 SQL을 몰라도 자연어로 처리할 수 있습니다. 별도 DB 서버 설치 없이 로컬 파일 하나로 강력한 데이터 관리가 가능합니다.",
                "short_description": "로컬 SQLite를 자연어로 관리하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "npx -y @modelcontextprotocol/server-sqlite /path/to/database.db",
                "package_name": "@modelcontextprotocol/server-sqlite",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "data",
                "demo_video_url": None,
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "database", "title": "서버 없이 로컬 DB", "description": "별도 데이터베이스 서버 설치 없이 로컬 파일 하나로 데이터를 관리합니다."},
                        {"icon": "edit", "title": "자연어로 데이터 관리", "description": "\"할일 목록 테이블 만들어줘\"라고 말하면 AI가 스키마를 설계하고 테이블을 생성합니다."},
                        {"icon": "folder-search", "title": "데이터 분석", "description": "저장된 데이터를 자연어로 분석하고, 통계와 인사이트를 도출합니다."},
                    ],
                    use_cases=[
                        {"persona": "개인 프로젝트", "scenario": "할일 목록, 독서 기록, 가계부 등 개인 데이터를 AI와 대화하며 관리", "benefit": "엑셀보다 강력한 관리"},
                        {"persona": "프로토타입 개발자", "scenario": "MVP 개발 시 빠르게 DB 스키마를 설계하고 테스트 데이터를 생성", "benefit": "SQL 작성 불필요"},
                    ],
                    scenarios=[
                        {
                            "title": "할일 관리 DB 만들기",
                            "description": "테이블을 확인하고, 데이터를 추가하고, 조회하는 기본 워크플로우",
                            "steps": [
                                {"tool_name": "list_tables", "sample_args": {}, "narration": "먼저 기존 테이블이 있는지 확인합니다."},
                                {"tool_name": "write_query", "sample_args": {"query": "INSERT INTO tasks (title, status, priority) VALUES ('MCP 문서 작성', 'pending', 'high')"}, "narration": "새 할일을 추가합니다."},
                                {"tool_name": "read_query", "sample_args": {"query": "SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority"}, "narration": "미완료 할일을 우선순위순으로 조회합니다."},
                            ],
                        },
                    ],
                ),
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
            # 10. Fetch Server
            {
                "name": "Fetch Server",
                "slug": "fetch-server",
                "description": "AI가 웹 페이지와 API에서 콘텐츠를 직접 가져와 분석합니다. 복잡한 HTML 페이지를 깔끔한 마크다운으로 변환하고, REST API 응답을 파싱하여 필요한 정보만 추출합니다. 웹 리서치와 API 연동 작업이 대화 한 번으로 끝납니다.",
                "short_description": "AI가 웹 콘텐츠를 가져와 분석하는 MCP 서버",
                "github_url": "https://github.com/modelcontextprotocol/servers",
                "github_stars": 78499,
                "install_command": "uvx mcp-server-fetch",
                "package_name": "mcp-server-fetch",
                "is_featured": False,
                "is_verified": True,
                "category_slug": "web",
                "demo_video_url": None,
                "showcase_data": _showcase(
                    highlights=[
                        {"icon": "globe", "title": "웹 페이지 깔끔 변환", "description": "복잡한 HTML을 읽기 좋은 마크다운 텍스트로 변환하여 AI가 내용을 분석합니다."},
                        {"icon": "database", "title": "API 응답 분석", "description": "REST API의 JSON 응답을 AI가 파싱하고 필요한 데이터를 추출합니다."},
                        {"icon": "zap", "title": "효율적 콘텐츠 추출", "description": "길이 제한 옵션으로 대용량 페이지도 필요한 만큼만 효율적으로 가져옵니다."},
                    ],
                    use_cases=[
                        {"persona": "리서처", "scenario": "기술 블로그, 뉴스 기사를 AI가 가져와 핵심 내용을 요약하고 정리", "benefit": "복사-붙여넣기 불필요"},
                        {"persona": "개발자", "scenario": "외부 API 응답 구조를 AI가 가져와 분석하고 연동 코드 작성을 도움", "benefit": "API 분석 자동화"},
                    ],
                    scenarios=[
                        {
                            "title": "웹 콘텐츠 가져와서 분석하기",
                            "description": "URL에서 콘텐츠를 가져와 AI가 분석하는 시나리오",
                            "steps": [
                                {"tool_name": "fetch", "sample_args": {"url": "https://example.com", "max_length": 5000}, "narration": "웹 페이지의 콘텐츠를 마크다운으로 변환하여 가져옵니다."},
                            ],
                        },
                    ],
                ),
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
                # Update existing servers
                existing.showcase_data = server_data.get("showcase_data")
                existing.description = server_data["description"]
                existing.short_description = server_data.get("short_description")
                existing.install_command = server_data.get("install_command")
                existing.package_name = server_data.get("package_name")
                db.flush()
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
