from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..domain import serialize_problem
from ..models import Problem
from ..security import require_token

router = APIRouter()
@router.get("/api/recommendations", dependencies=[Depends(require_token)])
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
