from typing import Literal

from pydantic import BaseModel


class ComponentHealth(BaseModel):
    status: Literal["ok", "error", "fallback"]
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str
    app_env: str
    database: ComponentHealth
    ai_provider: ComponentHealth
    botchain_rpc: ComponentHealth
