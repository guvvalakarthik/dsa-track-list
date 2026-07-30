from __future__ import annotations

import json
import os
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..domain import group_statuses, normalize_topics, slugify
from ..models import Problem, SyncRun
from ..schemas import SyncPayload
from ..security import require_token

router = APIRouter()
@router.post("/api/sync/{platform}", dependencies=[Depends(require_token)])
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


@router.post("/api/import/zerotrac", dependencies=[Depends(require_token)])
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


@router.get("/api/extension/status-map", dependencies=[Depends(require_token)])
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


@router.get("/api/sync-runs", dependencies=[Depends(require_token)])
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


@router.post("/api/import/leetcode-catalog", dependencies=[Depends(require_token)])
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
