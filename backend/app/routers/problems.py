from __future__ import annotations

import hashlib
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..domain import (
    group_statuses,
    normalize_problem_url,
    normalize_topics,
    serialize_problem,
)
from ..models import Problem
from ..schemas import LinkPayload, OverridePayload, TopicsPayload
from ..security import require_token

router = APIRouter()
@router.get("/api/summary", dependencies=[Depends(require_token)])
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


@router.get("/api/problems", dependencies=[Depends(require_token)])
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


@router.get("/api/problems/resolve", dependencies=[Depends(require_token)])
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


@router.put("/api/problems/{problem_id}/override", dependencies=[Depends(require_token)])
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


@router.put("/api/problems/{problem_id}/topics", dependencies=[Depends(require_token)])
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


@router.post("/api/equivalence-groups", dependencies=[Depends(require_token)])
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
