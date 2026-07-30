import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["TRACKER_TOKEN"] = ""

from fastapi.testclient import TestClient

from app.domain import normalize_problem_url, normalize_topics
from app.main import app

client = TestClient(app)


def test_url_normalization():
    assert normalize_problem_url(
        "https://leetcode.com/problems/two-sum/description/"
    )[:2] == ("leetcode", "two-sum")
    assert normalize_problem_url(
        "https://www.geeksforgeeks.org/problems/reverse-a-linked-list/1"
    )[:2] == ("gfg", "reverse-a-linked-list")


def test_topic_normalization():
    assert normalize_topics(["array", "DP", "Graph", "array"]) == [
        "Arrays",
        "Dynamic Programming",
        "Graphs",
    ]


def test_sync_resolve_and_override():
    response = client.post(
        "/api/sync/leetcode",
        json={
            "username": "tester",
            "problems": [
                {
                    "slug": "two-sum",
                    "title": "Two Sum",
                    "url": "https://leetcode.com/problems/two-sum/",
                    "topics": ["Array", "Hash Table"],
                    "accepted": True,
                }
            ],
        },
    )
    assert response.status_code == 200
    resolved = client.get(
        "/api/problems/resolve",
        params={"url": "https://leetcode.com/problems/two-sum/description/"},
    ).json()
    assert resolved["matched"] is True
    assert resolved["solved"] is True

    overridden = client.put(
        f"/api/problems/{resolved['id']}/override", json={"solved": False}
    ).json()
    assert overridden["solved"] is False
    cleared = client.put(
        f"/api/problems/{resolved['id']}/override", json={"solved": None}
    ).json()
    assert cleared["solved"] is True



def test_recommendations_use_solved_topic_similarity():
    response = client.post(
        "/api/sync/leetcode",
        json={
            "problems": [
                {
                    "slug": "recommendation-base",
                    "title": "Recommendation Base",
                    "url": "https://leetcode.com/problems/recommendation-base/",
                    "topics": ["Array", "Hash Table"],
                    "accepted": True,
                },
                {
                    "slug": "recommendation-next",
                    "title": "Recommendation Next",
                    "url": "https://leetcode.com/problems/recommendation-next/",
                    "topics": ["Array", "Hash Table", "Two Pointers"],
                    "accepted": False,
                },
            ]
        },
    )
    assert response.status_code == 200
    recommendations = client.get("/api/recommendations?limit=100").json()
    match = next(
        item for item in recommendations["items"]
        if item["slug"] == "recommendation-next"
    )
    assert "Arrays" in match["shared_topics"]
    assert "Recommendation Base" in {item["title"] for item in match["related_to"]}

def test_solved_filter_is_applied_before_pagination():
    response = client.post(
        "/api/sync/leetcode",
        json={
            "problems": [
                {
                    "slug": "aaa-open-pagination",
                    "title": "AAA Open Pagination",
                    "url": "https://leetcode.com/problems/aaa-open-pagination/",
                    "accepted": False,
                },
                {
                    "slug": "bbb-solved-pagination",
                    "title": "BBB Solved Pagination",
                    "url": "https://leetcode.com/problems/bbb-solved-pagination/",
                    "accepted": True,
                },
            ]
        },
    )
    assert response.status_code == 200

    page = client.get("/api/problems?solved=true&limit=1").json()
    assert page["count"] >= 1
    assert len(page["items"]) == 1
    assert page["items"][0]["solved"] is True
    assert page["limit"] == 1
    assert page["offset"] == 0


def test_summary_recent_solved_is_ordered_by_solved_time():
    response = client.post(
        "/api/sync/leetcode",
        json={
            "problems": [
                {
                    "slug": "older-solved",
                    "title": "Older Solved",
                    "url": "https://leetcode.com/problems/older-solved/",
                    "accepted": True,
                    "solved_at": "2024-01-01T00:00:00Z",
                },
                {
                    "slug": "newer-solved",
                    "title": "Newer Solved",
                    "url": "https://leetcode.com/problems/newer-solved/",
                    "accepted": True,
                    "solved_at": "2026-01-01T00:00:00Z",
                },
            ]
        },
    )
    assert response.status_code == 200

    recent = client.get("/api/summary").json()["recent_solved"]
    positions = {problem["slug"]: index for index, problem in enumerate(recent)}
    assert positions["newer-solved"] < positions["older-solved"]
