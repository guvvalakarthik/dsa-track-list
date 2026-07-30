from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlparse

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    or_,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool


def utcnow() -> datetime:
    return datetime.now(UTC)


ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tracker.db")


def validate_runtime_configuration(
    environment: str | None = None,
    token: str | None = None,
    cors_origins: list[str] | None = None,
) -> None:
    runtime = (environment or ENVIRONMENT).strip().lower()
    configured_token = os.getenv("TRACKER_TOKEN", "").strip() if token is None else token.strip()
    configured_origins = origins if cors_origins is None and "origins" in globals() else cors_origins
    if runtime not in {"staging", "production"}:
        return
    if len(configured_token) < 32:
        raise RuntimeError("TRACKER_TOKEN must contain at least 32 characters in staging/production")
    if configured_origins and "*" in configured_origins:
        raise RuntimeError("Wildcard CORS origins are forbidden in staging/production")
engine_options: dict = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
        engine_options["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


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


Base.metadata.create_all(engine)

app = FastAPI(
    title="TrackForge API",
    version="1.0.0",
    description="Personal LeetCode, GFG, and ZeroTrac progress tracker.",
)
origins = [
    value.strip()
    for value in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if value.strip()
]
validate_runtime_configuration(cors_origins=origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tracker-Token"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_token(
    x_tracker_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    configured = os.getenv("TRACKER_TOKEN", "").strip()
    if not configured:
        return
    supplied = x_tracker_token
    if not supplied and authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:]
    if not supplied or not secrets.compare_digest(supplied, configured):
        raise HTTPException(status_code=401, detail="Invalid tracker token")


CANONICAL_TOPIC_ALIASES = {
    "array": "Arrays",
    "arrays": "Arrays",
    "string": "Strings",
    "strings": "Strings",
    "hash table": "Hashing",
    "hashing": "Hashing",
    "dynamic programming": "Dynamic Programming",
    "dp": "Dynamic Programming",
    "graph": "Graphs",
    "graphs": "Graphs",
    "tree": "Trees",
    "binary tree": "Trees",
    "binary search": "Binary Search",
    "two pointers": "Two Pointers",
    "sliding window": "Sliding Window",
    "greedy": "Greedy",
    "backtracking": "Backtracking",
    "stack": "Stacks",
    "queue": "Queues",
    "heap (priority queue)": "Heaps",
    "heap": "Heaps",
    "linked list": "Linked Lists",
    "recursion": "Recursion",
    "bit manipulation": "Bit Manipulation",
    "trie": "Tries",
    "segment tree": "Segment Trees",
}


def normalize_topics(topics: list[str]) -> list[str]:
    output: list[str] = []
    for raw in topics:
        clean = re.sub(r"\s+", " ", raw).strip()
        if not clean:
            continue
        normalized = CANONICAL_TOPIC_ALIASES.get(clean.lower(), clean.title())
        if normalized not in output:
            output.append(normalized)
    return output


def slugify(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")


def normalize_problem_url(raw_url: str) -> tuple[str, str, str]:
    value = raw_url.strip()
    if not value:
        raise ValueError("URL is empty")
    if not re.match(r"^https?://", value, re.I):
        value = f"https://{value}"
    parsed = urlparse(value)
    host = parsed.netloc.lower().split(":")[0]
    segments = [segment for segment in parsed.path.split("/") if segment]

    if host in {"leetcode.com", "www.leetcode.com"}:
        if len(segments) >= 2 and segments[0] == "problems":
            slug = slugify(segments[1])
            return "leetcode", slug, f"https://leetcode.com/problems/{slug}/"
        raise ValueError("This is not a LeetCode problem URL")

    if host in {"geeksforgeeks.org", "www.geeksforgeeks.org", "practice.geeksforgeeks.org"}:
        if "problems" in segments:
            index = segments.index("problems")
            if len(segments) > index + 1:
                slug = slugify(segments[index + 1])
                return "gfg", slug, f"https://www.geeksforgeeks.org/problems/{slug}/1"
        raise ValueError("This is not a GFG problem URL")

    raise ValueError("Only LeetCode and GeeksforGeeks problem URLs are supported")


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


def serialize_problem(problem: Problem, group_solved: bool | None = None) -> dict:
    return {
        "id": problem.id,
        "platform": problem.platform,
        "external_id": problem.external_id,
        "slug": problem.slug,
        "title": problem.title,
        "url": problem.url,
        "difficulty": problem.difficulty,
        "rating": round(problem.rating) if problem.rating is not None else None,
        "contest": problem.contest,
        "question_index": problem.question_index,
        "topics": problem.topics,
        "custom_topics": problem.custom_topics,
        "auto_solved": problem.auto_solved,
        "manual_override": problem.manual_override,
        "solved": problem.solved,
        "group_solved": group_solved if group_solved is not None else problem.solved,
        "solved_at": problem.solved_at,
        "source": problem.source,
        "equivalence_key": problem.equivalence_key,
        "updated_at": problem.updated_at,
    }


def group_statuses(db: Session, problems: list[Problem]) -> dict[str, bool]:
    keys = {problem.equivalence_key for problem in problems if problem.equivalence_key}
    if not keys:
        return {}
    linked = db.scalars(select(Problem).where(Problem.equivalence_key.in_(keys))).all()
    result = {key: False for key in keys}
    for item in linked:
        if item.equivalence_key and item.solved:
            result[item.equivalence_key] = True
    return result


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "trackforge", "time": utcnow()}


@app.get("/api/auth/verify", dependencies=[Depends(require_token)])
def verify_auth() -> dict:
    return {"authenticated": True}


@app.get("/api/summary", dependencies=[Depends(require_token)])
def summary(db: Session = Depends(get_db)) -> dict:
    problems = db.scalars(select(Problem)).all()
    solved = [problem for problem in problems if problem.solved]
    recent_solved = sorted(
        solved,
        key=lambda problem: problem.solved_at or problem.updated_at or problem.created_at,
        reverse=True,
    )[:5]
    topics: dict[str, dict[str, int]] = {}
    for problem in problems:
        for topic in problem.topics + problem.custom_topics:
            bucket = topics.setdefault(topic, {"total": 0, "solved": 0})
            bucket["total"] += 1
            bucket["solved"] += int(problem.solved)
    return {
        "total": len(problems),
        "solved": len(solved),
        "leetcode_solved": sum(
            1 for problem in solved if problem.platform == "leetcode"
        ),
        "gfg_solved": sum(1 for problem in solved if problem.platform == "gfg"),
        "completion": round((len(solved) / len(problems) * 100), 1) if problems else 0,
        "recent_solved": [serialize_problem(problem) for problem in recent_solved],
        "topics": [
            {"name": name, **counts}
            for name, counts in sorted(
                topics.items(), key=lambda pair: (-pair[1]["total"], pair[0])
            )
        ],
    }


@app.get("/api/problems", dependencies=[Depends(require_token)])
def list_problems(
    platform: Literal["leetcode", "gfg"] | None = None,
    solved: bool | None = None,
    topic: str | None = None,
    search: str | None = None,
    min_rating: float | None = None,
    max_rating: float | None = None,
    limit: int = Query(default=100, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    conditions = []
    if platform:
        conditions.append(Problem.platform == platform)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(or_(Problem.title.ilike(term), Problem.slug.ilike(term)))
    if min_rating is not None:
        conditions.append(Problem.rating >= min_rating)
    if max_rating is not None:
        conditions.append(Problem.rating <= max_rating)
    if topic:
        normalized_topic = normalize_topics([topic])
        topic_value = normalized_topic[0] if normalized_topic else topic.strip()
        conditions.append(
            or_(
                Problem.topics_json.ilike(f'%"{topic_value}"%'),
                Problem.custom_topics_json.ilike(f'%"{topic_value}"%'),
            )
        )
    if solved is not None:
        conditions.append(
            func.coalesce(Problem.manual_override, Problem.auto_solved) == solved
        )

    total = db.scalar(select(func.count()).select_from(Problem).where(*conditions)) or 0
    query = (
        select(Problem)
        .where(*conditions)
        .order_by(Problem.rating.asc().nullslast(), Problem.title)
        .offset(offset)
        .limit(limit)
    )
    records = db.scalars(query).all()
    statuses = group_statuses(db, records)
    return {
        "items": [
            serialize_problem(
                problem,
                statuses.get(problem.equivalence_key, problem.solved)
                if problem.equivalence_key
                else problem.solved,
            )
            for problem in records
        ],
        "count": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/problems/resolve", dependencies=[Depends(require_token)])
def resolve_problem(url: str, db: Session = Depends(get_db)) -> dict:
    try:
        platform, slug, canonical_url = normalize_problem_url(url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    problem = db.scalar(
        select(Problem).where(Problem.platform == platform, Problem.slug == slug)
    )
    if not problem:
        return {
            "matched": False,
            "platform": platform,
            "slug": slug,
            "canonical_url": canonical_url,
            "solved": False,
        }
    group_solved = problem.solved
    if problem.equivalence_key:
        linked = db.scalars(
            select(Problem).where(Problem.equivalence_key == problem.equivalence_key)
        ).all()
        group_solved = any(item.solved for item in linked)
    return {
        "matched": True,
        "canonical_url": canonical_url,
        **serialize_problem(problem, group_solved),
    }


@app.put("/api/problems/{problem_id}/override", dependencies=[Depends(require_token)])
def set_override(
    problem_id: int, payload: OverridePayload, db: Session = Depends(get_db)
) -> dict:
    problem = db.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    problem.manual_override = payload.solved
    problem.updated_at = utcnow()
    db.commit()
    return serialize_problem(problem)


@app.put("/api/problems/{problem_id}/topics", dependencies=[Depends(require_token)])
def set_custom_topics(
    problem_id: int, payload: TopicsPayload, db: Session = Depends(get_db)
) -> dict:
    problem = db.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    problem.custom_topics_json = json.dumps(normalize_topics(payload.topics))
    problem.updated_at = utcnow()
    db.commit()
    return serialize_problem(problem)


@app.post("/api/equivalence-groups", dependencies=[Depends(require_token)])
def link_equivalent_problems(
    payload: LinkPayload, db: Session = Depends(get_db)
) -> dict:
    records = db.scalars(select(Problem).where(Problem.id.in_(payload.problem_ids))).all()
    if len(records) != len(set(payload.problem_ids)):
        raise HTTPException(status_code=404, detail="One or more problems were not found")
    key = payload.equivalence_key or hashlib.sha256(
        ",".join(map(str, sorted(payload.problem_ids))).encode()
    ).hexdigest()[:16]
    for problem in records:
        problem.equivalence_key = key
        problem.updated_at = utcnow()
    db.commit()
    return {"equivalence_key": key, "problem_ids": payload.problem_ids}


@app.post("/api/sync/{platform}", dependencies=[Depends(require_token)])
def sync_platform(
    platform: Literal["leetcode", "gfg"],
    payload: SyncPayload,
    db: Session = Depends(get_db),
) -> dict:
    imported = 0
    accepted = 0
    for incoming in payload.problems:
        slug = slugify(incoming.slug)
        canonical_url = (
            f"https://leetcode.com/problems/{slug}/"
            if platform == "leetcode"
            else f"https://www.geeksforgeeks.org/problems/{slug}/1"
        )
        problem = db.scalar(
            select(Problem).where(Problem.platform == platform, Problem.slug == slug)
        )
        if not problem:
            problem = Problem(
                platform=platform,
                slug=slug,
                title=incoming.title,
                url=incoming.url,
                source=platform,
            )
            db.add(problem)
        problem.title = incoming.title
        problem.url = canonical_url
        problem.external_id = (
            str(incoming.external_id) if incoming.external_id is not None else problem.external_id
        )
        problem.difficulty = incoming.difficulty or problem.difficulty
        if incoming.topics:
            problem.topics_json = json.dumps(normalize_topics(incoming.topics))
        if incoming.accepted:
            problem.auto_solved = True
            problem.solved_at = incoming.solved_at or problem.solved_at or utcnow()
            accepted += 1
        problem.source = platform
        problem.updated_at = utcnow()
        imported += 1
    db.add(
        SyncRun(
            source=platform,
            imported=imported,
            message=f"User: {payload.username}" if payload.username else None,
        )
    )
    db.commit()
    return {"platform": platform, "imported": imported, "accepted": accepted}


def first_value(item: dict, *keys: str):
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return item[key]
    return None


@app.post("/api/import/zerotrac", dependencies=[Depends(require_token)])
def import_zerotrac(db: Session = Depends(get_db)) -> dict:
    data_url = os.getenv(
        "ZEROTRAC_DATA_URL",
        "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/data.json",
    )
    try:
        response = httpx.get(data_url, timeout=30, follow_redirects=True)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        db.add(SyncRun(source="zerotrac", status="failed", message=str(exc)))
        db.commit()
        raise HTTPException(status_code=502, detail=f"ZeroTrac import failed: {exc}") from exc

    records = payload if isinstance(payload, list) else payload.get("data", [])
    imported = 0
    for item in records:
        slug = first_value(item, "TitleSlug", "titleSlug", "slug")
        title = first_value(item, "Title", "title")
        if not slug or not title:
            continue
        slug = slugify(str(slug))
        problem = db.scalar(
            select(Problem).where(
                Problem.platform == "leetcode", Problem.slug == slug
            )
        )
        if not problem:
            problem = Problem(
                platform="leetcode",
                slug=slug,
                title=str(title),
                url=f"https://leetcode.com/problems/{slug}/",
                source="zerotrac",
            )
            db.add(problem)
        problem.title = str(title)
        problem.external_id = str(first_value(item, "ID", "id") or "") or None
        rating = first_value(item, "Rating", "rating")
        problem.rating = float(rating) if rating is not None else problem.rating
        problem.contest = first_value(item, "ContestSlug", "contestSlug", "contest")
        problem.question_index = first_value(
            item, "ProblemIndex", "problemIndex", "index"
        )
        problem.updated_at = utcnow()
        imported += 1
    db.add(SyncRun(source="zerotrac", imported=imported))
    db.commit()
    return {"source": "zerotrac", "imported": imported}


@app.get("/api/extension/status-map", dependencies=[Depends(require_token)])
def extension_status_map(db: Session = Depends(get_db)) -> dict:
    problems = db.scalars(select(Problem)).all()
    statuses = group_statuses(db, problems)
    return {
        "leetcode": {
            problem.slug: statuses.get(problem.equivalence_key, problem.solved)
            if problem.equivalence_key
            else problem.solved
            for problem in problems
            if problem.platform == "leetcode"
        },
        "gfg": {
            problem.slug: statuses.get(problem.equivalence_key, problem.solved)
            if problem.equivalence_key
            else problem.solved
            for problem in problems
            if problem.platform == "gfg"
        },
        "generated_at": utcnow(),
    }


@app.get("/api/sync-runs", dependencies=[Depends(require_token)])
def sync_runs(db: Session = Depends(get_db)) -> list[dict]:
    runs = db.scalars(
        select(SyncRun).order_by(SyncRun.created_at.desc()).limit(20)
    ).all()
    return [
        {
            "id": run.id,
            "source": run.source,
            "imported": run.imported,
            "status": run.status,
            "message": run.message,
            "created_at": run.created_at,
        }
        for run in runs
    ]



LEETCODE_CATALOG_QUERY = """
query problemsetQuestionListV2(
  $filters: QuestionFilterInput
  $limit: Int
  $skip: Int
  $categorySlug: String
) {
  problemsetQuestionListV2(
    filters: $filters
    limit: $limit
    skip: $skip
    categorySlug: $categorySlug
  ) {
    questions {
      questionFrontendId
      title
      titleSlug
      difficulty
      topicTags { name slug }
    }
    totalLength
    hasMore
  }
}
"""


def leetcode_catalog_filters() -> dict:
    empty_is = {"operator": "IS"}
    return {
        "filterCombineType": "ALL",
        "statusFilter": {**empty_is, "questionStatuses": []},
        "difficultyFilter": {**empty_is, "difficulties": []},
        "languageFilter": {**empty_is, "languageSlugs": []},
        "topicFilter": {**empty_is, "topicSlugs": []},
        "companyFilter": {**empty_is, "companySlugs": []},
        "positionFilter": {**empty_is, "positionSlugs": []},
        "positionLevelFilter": {**empty_is, "positionLevelSlugs": []},
        "contestPointFilter": {**empty_is, "contestPoints": []},
        "premiumFilter": {**empty_is, "premiumStatus": []},
        "acceptanceFilter": {},
        "frequencyFilter": {},
        "frontendIdFilter": {},
        "lastSubmittedFilter": {},
        "publishedFilter": {},
    }


@app.post("/api/import/leetcode-catalog", dependencies=[Depends(require_token)])
def import_leetcode_catalog(db: Session = Depends(get_db)) -> dict:
    imported = 0
    classified = 0
    skip = 0
    total = 1
    page_size = 100
    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            while skip < total:
                response = client.post(
                    "https://leetcode.com/graphql/",
                    headers={
                        "Content-Type": "application/json",
                        "x-operation-name": "problemsetQuestionListV2",
                    },
                    json={
                        "query": LEETCODE_CATALOG_QUERY,
                        "operationName": "problemsetQuestionListV2",
                        "variables": {
                            "filters": leetcode_catalog_filters(),
                            "limit": page_size,
                            "skip": skip,
                            "categorySlug": "all-code-essentials",
                        },
                    },
                )
                response.raise_for_status()
                payload = response.json()
                if payload.get("errors"):
                    raise RuntimeError(payload["errors"][0].get("message", "GraphQL error"))
                page = payload.get("data", {}).get("problemsetQuestionListV2")
                if not page:
                    raise RuntimeError("LeetCode catalogue response was empty")
                total = int(page.get("totalLength") or 0)
                for item in page.get("questions") or []:
                    slug = slugify(str(item.get("titleSlug") or ""))
                    if not slug:
                        continue
                    problem = db.scalar(
                        select(Problem).where(
                            Problem.platform == "leetcode", Problem.slug == slug
                        )
                    )
                    if not problem:
                        problem = Problem(
                            platform="leetcode",
                            slug=slug,
                            title=str(item.get("title") or slug.replace("-", " ").title()),
                            url=f"https://leetcode.com/problems/{slug}/",
                            source="leetcode-catalog",
                        )
                        db.add(problem)
                    problem.title = str(item.get("title") or problem.title)
                    problem.external_id = str(item.get("questionFrontendId") or "") or problem.external_id
                    problem.difficulty = str(item.get("difficulty") or "").title() or problem.difficulty
                    topics = normalize_topics(
                        [tag.get("name", "") for tag in item.get("topicTags") or []]
                    )
                    if topics:
                        problem.topics_json = json.dumps(topics)
                        classified += 1
                    problem.updated_at = utcnow()
                    imported += 1
                db.commit()
                skip += page_size
    except Exception as exc:
        db.rollback()
        db.add(SyncRun(source="leetcode-catalog", status="failed", message=str(exc)))
        db.commit()
        raise HTTPException(status_code=502, detail=f"LeetCode catalogue import failed: {exc}") from exc

    db.add(
        SyncRun(
            source="leetcode-catalog",
            imported=imported,
            message=f"Classified {classified} problem records",
        )
    )
    db.commit()
    return {
        "source": "leetcode-catalog",
        "imported": imported,
        "classified": classified,
    }


@app.get("/api/recommendations", dependencies=[Depends(require_token)])
def recommendations(
    limit: int = Query(default=24, ge=1, le=100),
    topic: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    all_problems = db.scalars(select(Problem).where(Problem.platform == "leetcode")).all()
    solved = [problem for problem in all_problems if problem.solved]
    if not solved:
        return {"items": [], "solved_basis": 0, "message": "Sync solved problems first."}

    topic_frequency: dict[str, int] = {}
    for problem in solved:
        for item in problem.topics:
            topic_frequency[item] = topic_frequency.get(item, 0) + 1

    solved_ratings = sorted(problem.rating for problem in solved if problem.rating is not None)
    target_rating = None
    if solved_ratings:
        target_rating = solved_ratings[min(len(solved_ratings) - 1, int(len(solved_ratings) * 0.7))]

    ranked: list[tuple[float, Problem, list[str], list[Problem]]] = []
    for candidate in all_problems:
        if candidate.solved or not candidate.topics:
            continue
        if topic and topic not in candidate.topics:
            continue
        shared_topics = [item for item in candidate.topics if topic_frequency.get(item)]
        if not shared_topics:
            continue

        candidate_topics = set(candidate.topics)
        related_scored: list[tuple[float, Problem]] = []
        for solved_problem in solved:
            solved_topics = set(solved_problem.topics)
            intersection = candidate_topics & solved_topics
            if not intersection:
                continue
            similarity = len(intersection) / max(1, len(candidate_topics | solved_topics))
            if candidate.difficulty == solved_problem.difficulty:
                similarity += 0.08
            related_scored.append((similarity, solved_problem))
        related_scored.sort(key=lambda pair: pair[0], reverse=True)
        related = [pair[1] for pair in related_scored[:3]]
        best_similarity = related_scored[0][0] if related_scored else 0
        familiarity = sum(topic_frequency[item] for item in shared_topics) / max(1, len(solved))
        rating_fit = 0.0
        if target_rating is not None and candidate.rating is not None:
            rating_fit = max(0.0, 1.0 - abs(candidate.rating - target_rating) / 700)
        score = best_similarity * 6 + familiarity * 2 + len(shared_topics) * 0.35 + rating_fit * 1.5
        ranked.append((score, candidate, shared_topics, related))

    ranked.sort(
        key=lambda row: (
            -row[0],
            row[1].rating is None,
            row[1].rating if row[1].rating is not None else 99999,
            row[1].title,
        )
    )
    items = []
    for score, candidate, shared_topics, related in ranked[:limit]:
        item = serialize_problem(candidate)
        item.update(
            {
                "recommendation_score": round(score, 3),
                "shared_topics": shared_topics[:4],
                "related_to": [
                    {"id": problem.id, "title": problem.title, "url": problem.url}
                    for problem in related
                ],
                "reason": (
                    f"Builds on {', '.join(shared_topics[:3])}"
                    + (f" after {related[0].title}" if related else "")
                ),
            }
        )
        items.append(item)
    return {
        "items": items,
        "solved_basis": len(solved),
        "target_rating": round(target_rating) if target_rating is not None else None,
        "topics_used": len(topic_frequency),
    }
