from pydantic_settings import BaseSettings, SettingsConfigDict


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
    GITHUB_TOKEN: str | None = None


settings = Settings()
