"""
GitHub 배치 동기화 서비스.
모든 MCP 서버의 GitHub stars/README를 일괄 업데이트합니다.
"""
import logging
from sqlalchemy.orm import Session
from app.models.mcp_server import McpServer
from app.crud.mcp_server import update_github_stats
from app.services.github import GitHubService
from app.core.config import settings

logger = logging.getLogger(__name__)


async def sync_all_github_stats(db: Session):
    """모든 MCP 서버의 GitHub stats를 동기화합니다. URL별로 그룹화하여 중복 API 호출을 방지합니다."""
    servers = db.query(McpServer).filter(McpServer.github_url.isnot(None)).all()
    if not servers:
        return

    # URL별로 서버 ID 그룹화 (모노레포 중복 방지)
    url_map: dict[str, list[int]] = {}
    for s in servers:
        url_map.setdefault(s.github_url, []).append(s.id)

    github = GitHubService(token=settings.GITHUB_TOKEN)

    for url, server_ids in url_map.items():
        repo_info = await github.get_repo_info(url)
        if repo_info.get("rate_limited"):
            logger.warning("GitHub rate limit reached, stopping sync")
            break

        readme = await github.get_readme(url)

        for sid in server_ids:
            update_github_stats(db, sid, stars=repo_info["stars"], readme=readme)

    logger.info(f"GitHub sync completed for {len(servers)} servers")
