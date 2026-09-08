from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator
from urllib.parse import urlsplit


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    AUTH_SESSION_ENABLED: bool = False
    AUTH_SESSION_ORIGIN: str = 'https://jionc.com'
    AUTH_SESSION_ALLOWED_ORIGINS: str = 'https://jionc.com,https://blog.jionc.com'
    AUTH_SESSION_SECURE: bool = True

    @model_validator(mode='after')
    def validate_browser_session_origins(self):
        if not self.AUTH_SESSION_ENABLED:
            return self
        origins=[self.AUTH_SESSION_ORIGIN]+self.AUTH_SESSION_ALLOWED_ORIGINS.split(',')
        for value in origins:
            parsed=urlsplit(value.strip().rstrip('/'))
            local=parsed.hostname in {'localhost','127.0.0.1','::1'}
            if not parsed.netloc or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment or parsed.scheme not in {'http','https'}:
                raise ValueError('Browser session origins must be exact origins')
            if (parsed.scheme!='https' or not self.AUTH_SESSION_SECURE) and not local:
                raise ValueError('Production browser sessions require HTTPS and Secure cookies')
        allowed={x.strip().rstrip('/') for x in self.AUTH_SESSION_ALLOWED_ORIGINS.split(',')}
        if self.AUTH_SESSION_ORIGIN.rstrip('/') not in allowed:
            raise ValueError('Auth origin must be an allowed browser origin')
        redirect = (self.OAUTH_FRONTEND_DEFAULT_REDIRECT or '').strip()
        if redirect and redirect != '/oauth/callback':
            parsed = urlsplit(redirect)
            origin = f'{parsed.scheme}://{parsed.netloc}'
            local_auth = urlsplit(self.AUTH_SESSION_ORIGIN).hostname in {'localhost', '127.0.0.1', '::1'}
            valid_origin = origin in allowed if local_auth else origin == self.AUTH_SESSION_ORIGIN.rstrip('/')
            if (not valid_origin or parsed.path != '/oauth/callback' or parsed.query or parsed.fragment
                    or parsed.username or parsed.password):
                raise ValueError('OAuth frontend redirect must use the canonical callback on the trusted main frontend')
        return self
    SIGNAL_BOT_TOKEN: Optional[str] = None
    SIGNAL_COMMENT_RATE_LIMIT_PER_MINUTE: int = 20

    # CORS settings - comma-separated list of origins
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost"

    # GitHub API (optional, for higher rate limits)
    GITHUB_TOKEN: Optional[str] = None

    # Optional startup admin bootstrap (disabled unless all 3 values are set)
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None
    BOOTSTRAP_ADMIN_USERNAME: Optional[str] = None
    BOOTSTRAP_ADMIN_PASSWORD: Optional[str] = None

    # SEO — Search Console verification codes (leave empty to skip)
    GOOGLE_SITE_VERIFICATION: Optional[str] = None
    NAVER_SITE_VERIFICATION: Optional[str] = None

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
    BLOG_PUBLIC_ORIGIN: str = "https://blog.jionc.com"
    BLOG_OWNER_USER_ID: Optional[int] = Field(default=None, gt=0)
    BLOG_HTML_TEMPLATE: str = "/app/blog-template/index.html"
    EMAIL_VERIFICATION_FRONTEND_BASE_URL: Optional[str] = None

    # Email verification
    EMAIL_VERIFICATION_TOKEN_TTL_HOURS: int = 24
    EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS: int = 600
    EMAIL_VERIFICATION_RESEND_MAX_ATTEMPTS: int = 5
    SIGNUP_EMAIL_CODE_TTL_MINUTES: int = 10
    SIGNUP_EMAIL_CODE_LENGTH: int = 6
    SIGNUP_EMAIL_SEND_WINDOW_SECONDS: int = 600
    SIGNUP_EMAIL_SEND_MAX_ATTEMPTS: int = 5
    SIGNUP_EMAIL_CONFIRM_WINDOW_SECONDS: int = 600
    SIGNUP_EMAIL_CONFIRM_MAX_ATTEMPTS: int = 10
    SIGNUP_EMAIL_VERIFICATION_TICKET_TTL_MINUTES: int = 30

    # SMTP (optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "jion"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # MCP Playground settings
    MCP_ALLOWED_SERVERS: str = "fetch-server"
    MCP_CONNECT_TIMEOUT: int = 30
    MCP_INVOKE_TIMEOUT: int = 60
    MCP_SESSION_TTL: int = 300

    # AI assistant settings
    AI_API_KEY: Optional[str] = None
    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_ROUTE_MODEL: str = "gpt-4.1-mini"
    AI_CHAT_MODEL: str = "gpt-4.1-mini"
    AI_EDITOR_MODEL: str = "gpt-4.1-mini"
    AI_EDITOR_FALLBACK_MODEL: Optional[str] = "gpt-4.1-mini"
    AI_TIMEOUT_SECONDS: int = 12
    AI_EDITOR_TIMEOUT_SECONDS: int = 45
    AI_ROUTE_MAX_TOKENS: int = 120
    AI_CHAT_MAX_TOKENS: int = 600
    AI_EDITOR_MAX_TOKENS: int = 900
    AI_RATE_LIMIT_WINDOW_SECONDS: int = 60
    AI_RATE_LIMIT_MAX_REQUESTS: int = 20
    AI_CACHE_TTL_SECONDS: int = 180
    AI_CACHE_MAX_ITEMS: int = 500
    AI_INPUT_COST_PER_1K_USD: float = 0.0
    AI_OUTPUT_COST_PER_1K_USD: float = 0.0


settings = Settings()
