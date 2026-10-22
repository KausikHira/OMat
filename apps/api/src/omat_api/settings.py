"""Runtime configuration.

All Python services read the same ``OMAT_*`` variables, so local development and
containers behave the same way.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="OMAT_",
        extra="ignore",
    )

    env: str = "local"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]

    opensearch_url: str = "http://localhost:9200"
    opensearch_index_alias: str = "papers"

    redis_url: str = "redis://localhost:6379/0"
    postgres_dsn: str = "postgresql+psycopg://omat:omat@localhost:5432/omat"
    kafka_brokers: str = "localhost:9092"

    # Per-paper chat. Verify the exact model ID against Google's current catalog
    # before setting this; "3.8-flash" is not a confirmed name.
    gemini_api_key: str | None = None
    gemini_model: str | None = None

    # External literature (Valency MCP). None/disabled = feature off, endpoints
    # degrade gracefully instead of erroring.
    valency_bearer_token: str | None = None
    valency_mcp_url: str = "https://mcp.valency.io/"
    valency_enabled: bool = True
    valency_search_ttl: int = 900  # seconds
    valency_trends_ttl: int = 86400


@lru_cache
def get_settings() -> Settings:
    return Settings()
