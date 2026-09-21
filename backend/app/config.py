from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AgentGuard API"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./agentguard.db"

    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60

    cors_origins: str = "http://localhost:5173"

    ai_provider: str = "ollama"
    ai_model: str = "minquen-3.8-unsensored"
    ollama_base_url: str = "http://localhost:11434"
    model_timeout_seconds: float = 15.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()