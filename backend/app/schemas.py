from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SyncProblem(BaseModel):
    slug: str = Field(min_length=1)
    title: str = Field(min_length=1)
    url: str = Field(min_length=10, max_length=700)
    external_id: str | int | None = None
    difficulty: str | None = None
    topics: list[str] = Field(default_factory=list, max_length=100)
    accepted: bool = True
    solved_at: datetime | None = None


class SyncPayload(BaseModel):
    username: str | None = Field(default=None, max_length=120)
    problems: list[SyncProblem] = Field(max_length=5000)


class OverridePayload(BaseModel):
    solved: bool | None


class TopicsPayload(BaseModel):
    topics: list[str]


class LinkPayload(BaseModel):
    problem_ids: list[int] = Field(min_length=2)
    equivalence_key: str | None = None