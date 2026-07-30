from __future__ import annotations

import re
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Problem

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
