"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. SECRET_KEY has no default and must be provided."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="sqlite:///./data/vastra.db",
        validation_alias="DATABASE_URL",
    )
    secret_key: str = Field(validation_alias="SECRET_KEY")
    jwt_expire_hours: int = Field(default=72, validation_alias="JWT_EXPIRE_HOURS")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
