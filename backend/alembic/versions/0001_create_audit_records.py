"""create audit records

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_id", sa.String(length=36), nullable=False),
        sa.Column("wallet", sa.String(length=42), nullable=False),
        sa.Column("prompt_hash", sa.String(length=64), nullable=True),
        sa.Column("decision", sa.String(length=10), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("recipient", sa.String(length=42), nullable=True),
        sa.Column("amount_bot", sa.String(length=80), nullable=True),
        sa.Column("chain_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_records_created_at", "audit_records", ["created_at"])
    op.create_index("ix_audit_records_decision", "audit_records", ["decision"])
    op.create_index("ix_audit_records_request_id", "audit_records", ["request_id"])
    op.create_index("ix_audit_records_wallet", "audit_records", ["wallet"])


def downgrade() -> None:
    op.drop_index("ix_audit_records_wallet", table_name="audit_records")
    op.drop_index("ix_audit_records_request_id", table_name="audit_records")
    op.drop_index("ix_audit_records_decision", table_name="audit_records")
    op.drop_index("ix_audit_records_created_at", table_name="audit_records")
    op.drop_table("audit_records")
