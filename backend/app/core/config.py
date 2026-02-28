from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # CORS settings - comma-separated list of origins
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost"

    # GitHub API (optional, for higher rate limits)
    GITHUB_TOKEN: Optional[str] = None

    # Optional startup admin bootstrap (disabled unless all 3 values are set)
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None
    BOOTSTRAP_ADMIN_USERNAME: Optional[str] = None
    BOOTSTRAP_ADMIN_PASSWORD: Optional[str] = None

    # Monitoring
    REQUEST_LOG_ENABLED: bool = True
    SLOW_REQUEST_THRESHOLD_MS: int = 500
    API_DOCS_ENABLED: bool = True

    # OAuth (optional)
    GOOGLE_OAUTH_CLIENT_ID: Optional[str] = None
    GOOGLE_OAUTH_CLIENT_SECRET: Optional[str] = None
    GITHUB_OAUTH_CLIENT_ID: Optional[str] = None
    GITHUB_OAUTH_CLIENT_SECRET: Optional[str] = None
    OAUTH_FRONTEND_DEFAULT_REDIRECT: str = "http://localhost:5173/oauth/callback"

    # MCP Playground settings
    MCP_ALLOWED_SERVERS: str = "fetch-server"  # 실제 연결 허용 서버 slug (쉼표 구분)
    MCP_CONNECT_TIMEOUT: int = 30  # 연결 타임아웃 (초)
    MCP_INVOKE_TIMEOUT: int = 60  # tool 실행 타임아웃 (초)
    MCP_SESSION_TTL: int = 300  # 유휴 세션 TTL (초)


settings = Settings()
