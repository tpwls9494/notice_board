import httpx
from typing import Optional
import logging

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubService:
    def __init__(self, token: Optional[str] = None):
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            self.headers["Authorization"] = f"token {token}"

    def _parse_owner_repo(self, github_url: str) -> tuple[str, str]:
        parts = github_url.rstrip("/").split("/")
        return parts[-2], parts[-1]

    async def get_repo_info(self, github_url: str) -> dict:
        owner, repo = self._parse_owner_repo(github_url)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}",
                    headers=self.headers,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "stars": data.get("stargazers_count", 0),
                        "description": data.get("description", ""),
                        "language": data.get("language"),
                    }
                elif response.status_code == 403:
                    logger.warning("GitHub API rate limit reached")
                    return {"stars": 0, "description": "", "language": None, "rate_limited": True}
        except httpx.RequestError as e:
            logger.error(f"GitHub API request failed: {e}")
        return {"stars": 0, "description": "", "language": None}

    async def get_readme(self, github_url: str) -> Optional[str]:
        owner, repo = self._parse_owner_repo(github_url)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme",
                    headers={**self.headers, "Accept": "application/vnd.github.v3.raw"},
                    timeout=10.0,
                )
                if response.status_code == 200:
                    return response.text
        except httpx.RequestError as e:
            logger.error(f"GitHub README fetch failed: {e}")
        return None
