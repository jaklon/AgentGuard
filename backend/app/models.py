from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )
    request_id: Mapped[str] = mapped_column(String(36), index=True)
    wallet: Mapped[str] = mapped_column(String(42), index=True)
    prompt_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decision: Mapped[str] = mapped_column(String(10), index=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    recipient: Mapped[str | None] = mapped_column(String(42), nullable=True)
    amount_bot: Mapped[str | None] = mapped_column(String(80), nullable=True)
    chain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(20))
