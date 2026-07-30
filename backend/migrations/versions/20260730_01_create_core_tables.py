"""Create TrackForge core tables.

Revision ID: 20260730_01
Revises:
Create Date: 2026-07-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260730_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "problems",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=False),
        sa.Column("external_id", sa.String(length=80), nullable=True),
        sa.Column("slug", sa.String(length=240), nullable=False),
        sa.Column("title", sa.String(length=320), nullable=False),
        sa.Column("url", sa.String(length=700), nullable=False),
        sa.Column("difficulty", sa.String(length=30), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("contest", sa.String(length=180), nullable=True),
        sa.Column("question_index", sa.String(length=20), nullable=True),
        sa.Column("topics_json", sa.Text(), nullable=False),
        sa.Column("custom_topics_json", sa.Text(), nullable=False),
        sa.Column("auto_solved", sa.Boolean(), nullable=False),
        sa.Column("manual_override", sa.Boolean(), nullable=True),
        sa.Column("solved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("equivalence_key", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("platform", "slug", name="uq_platform_slug"),
    )
    op.create_index("ix_problems_auto_solved", "problems", ["auto_solved"])
    op.create_index("ix_problems_equivalence_key", "problems", ["equivalence_key"])
    op.create_index("ix_problems_platform", "problems", ["platform"])
    op.create_index("ix_problems_rating", "problems", ["rating"])
    op.create_index("ix_problems_slug", "problems", ["slug"])

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("imported", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sync_runs_source", "sync_runs", ["source"])


def downgrade() -> None:
    op.drop_index("ix_sync_runs_source", table_name="sync_runs")
    op.drop_table("sync_runs")
    op.drop_index("ix_problems_slug", table_name="problems")
    op.drop_index("ix_problems_rating", table_name="problems")
    op.drop_index("ix_problems_platform", table_name="problems")
    op.drop_index("ix_problems_equivalence_key", table_name="problems")
    op.drop_index("ix_problems_auto_solved", table_name="problems")
    op.drop_table("problems")