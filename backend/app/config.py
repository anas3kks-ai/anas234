from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    inception_api_key: str = ""
    inception_base_url: str = "https://api.inceptionlabs.ai/v1"
    inception_model: str = "mercury-2"

    e2b_api_key: str = ""
    browserless_token: str = ""
    browserless_base_url: str = "https://production-sfo.browserless.io"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "sqlite:///./omni_agent.db"
    cors_origins: str = "http://localhost:3000"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
