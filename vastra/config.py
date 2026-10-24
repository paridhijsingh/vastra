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
    # Optional. Emergency Fit returns 503 when NEBIUS_API_KEY is missing.
    nebius_api_key: str | None = Field(default=None, validation_alias="NEBIUS_API_KEY")
    nebius_base_url: str = Field(
        default="https://api.tokenfactory.nebius.com/v1/",
        validation_alias="NEBIUS_BASE_URL",
    )
    nemotron_model: str = Field(
        default="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        validation_alias="NEMOTRON_MODEL",
    )
    stylist_model: str = Field(
        default="nvidia/nemotron-3-super-120b-a12b",
        validation_alias="STYLIST_MODEL",
    )
    nemotron_timeout_seconds: float = Field(default=60, validation_alias="NEMOTRON_TIMEOUT_SECONDS")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
