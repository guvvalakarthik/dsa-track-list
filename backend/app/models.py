from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base, utcnow


class Problem(Base):
    __tablename__ = "problems"
    __table_args__ = (UniqueConstraint("platform", "slug", name="uq_platform_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String(20), index=True)
    external_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    slug: Mapped[str] = mapped_column(String(240), index=True)
    title: Mapped[str] = mapped_column(String(320))
    url: Mapped[str] = mapped_column(String(700))
    difficulty: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    contest: Mapped[str | None] = mapped_column(String(180), nullable=True)
    question_index: Mapped[str | None] = mapped_column(String(20), nullable=True)
    topics_json: Mapped[str] = mapped_column(Text, default="[]")
    custom_topics_json: Mapped[str] = mapped_column(Text, default="[]")
    auto_solved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    manual_override: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    equivalence_key: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    @property
    def solved(self) -> bool:
        return self.manual_override if self.manual_override is not None else self.auto_solved

    @property
    def topics(self) -> list[str]:
        return json.loads(self.topics_json or "[]")

    @property
    def custom_topics(self) -> list[str]:
        return json.loads(self.custom_topics_json or "[]")


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(40), index=True)
    imported: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="success")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)