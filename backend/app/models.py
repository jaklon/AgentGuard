from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint

from app.database import Base


class GuardEvaluation(Base):
    __tablename__ = "guard_evaluations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    instruction: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    recipient: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    amount_bot: Mapped[Decimal] = mapped_column(
        Numeric(38, 18),
        nullable=False,
    )

    network: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    purpose: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    decision: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    risk_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    transaction_hash: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

class RateLimitState(Base):
    __tablename__ = "rate_limit_state"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    client_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    scope: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    window_start: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    request_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    __table_args__ = (
        UniqueConstraint(
            "client_key",
            "scope",
            "window_start",
            name="uq_rate_limit_state_window",
        ),
    )