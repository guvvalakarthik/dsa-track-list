from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite:///./tracker.db"
    tracker_token: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    zerotrac_data_url: str = (
        "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/data.json"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]


def get_settings() -> Settings:
    return Settings()


def validate_runtime_configuration(
    environment: str,
    token: str,
    cors_origins: list[str],
) -> None:
    runtime = environment.strip().lower()
    if runtime not in {"staging", "production"}:
        return
    if len(token.strip()) < 32:
        raise RuntimeError("TRACKER_TOKEN must contain at least 32 characters in staging/production")
    if "*" in cors_origins:
        raise RuntimeError("Wildcard CORS origins are forbidden in staging/production")