from __future__ import annotations

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "INFO"
    agent_allowed_origins: str = "http://localhost:5173,http://localhost"
    api_rate_limit_per_minute: int = Field(default=30, ge=1, le=1000)
    max_request_bytes: int = Field(default=16_384, ge=1024, le=1_048_576)

    database_url: str = "sqlite:///./backend/data/agentguard.db"

    botchain_testnet_rpc_url: str = "https://rpc.bohr.life"
    botchain_testnet_chain_id: int = 968
    botchain_testnet_explorer_url: str = "https://scan.bohr.life"
    botchain_contract_address: str = ""
    botchain_allocation_wallet: str = "0x1905B29C6F01eDe290010DB081A6ad0Ba78A1a91"

    ai_provider: str = "openai"
    ai_model: str = "gpt-5-mini"
    openai_api_key: str = ""
    model_timeout_seconds: float = Field(default=15, ge=1, le=60)

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.agent_allowed_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.app_env.lower() != "production":
            return self
        if not self.botchain_contract_address:
            raise ValueError("BOTCHAIN_CONTRACT_ADDRESS is required in production")
        if not self.allowed_origins or any(not origin.startswith("https://") for origin in self.allowed_origins):
            raise ValueError("production CORS origins must be HTTPS")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
