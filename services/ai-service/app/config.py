from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_SERVICE_")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_service_dev"
    directory_api_base_url: str = "http://localhost:5256"
    scheduling_api_base_url: str = "http://localhost:5098"


settings = Settings()
