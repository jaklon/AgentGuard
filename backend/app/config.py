from __future__ import annotations

from functools import lru_cache
from typing import ClassVar, Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    _rate_limit_config_version: ClassVar[int] = 0
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
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    max_request_bytes: int = Field(default=16_384, ge=1024, le=1_048_576)

    database_url: str = "sqlite:///./backend/data/agentguard.db"

    botchain_testnet_rpc_url: str = "https://rpc.bohr.life"
    botchain_testnet_chain_id: int = 968
    botchain_testnet_explorer_url: str = "https://scan.bohr.life"
    botchain_testnet_faucet_url: str = "https://faucet.botchain.ai"
    botchain_bundler_url: str = "https://bundler.bohr.life/rpc/"
    botchain_entry_point: str = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    botchain_contract_deployment_block: int = Field(default=0, ge=0)
    botchain_contract_address: str = ""
    botchain_allocation_wallet: str = "0x1905B29C6F01eDe290010DB081A6ad0Ba78A1a91"

    ai_provider: Literal["openai", "llama_cpp", "disabled"] = "llama_cpp"
    ai_model: str = "Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
    openai_api_key: str = ""
    local_llm_base_url: str = "http://llm:8080"
    model_timeout_seconds: float = Field(default=60, ge=1, le=180)

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
        if self.ai_provider == "llama_cpp" and not self.local_llm_base_url.startswith(("http://", "https://")):
            raise ValueError("LOCAL_LLM_BASE_URL must be an HTTP(S) URL")
        return self


    @property
    def rate_limit_requests(self) -> int:
        return self.api_rate_limit_per_minute

    @rate_limit_requests.setter
    def rate_limit_requests(self, value: int) -> None:
        self.api_rate_limit_per_minute = value
        type(self)._rate_limit_config_version += 1

    @property
    def rate_limit_config_version(self) -> int:
        return type(self)._rate_limit_config_version

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
