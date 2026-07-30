from fastapi.testclient import TestClient

from app.config import validate_runtime_configuration
from app.main import app
from app.routers import sync as sync_router

client = TestClient(app)


def sync_problem(slug: str, *, accepted: bool = False, topics: list[str] | None = None):
    return client.post(
        "/api/sync/leetcode",
        json={
            "problems": [
                {
                    "slug": slug,
                    "title": slug.replace("-", " ").title(),
                    "url": f"https://leetcode.com/problems/{slug}/",
                    "accepted": accepted,
                    "topics": topics or [],
                }
            ]
        },
    )


def test_protected_routes_require_configured_token(monkeypatch):
    monkeypatch.setenv("TRACKER_TOKEN", "test-secret")

    assert client.get("/api/health").status_code == 200
    assert client.get("/api/summary").status_code == 401
    assert client.get(
        "/api/summary", headers={"X-Tracker-Token": "test-secret"}
    ).status_code == 200
    assert client.get(
        "/api/summary", headers={"Authorization": "Bearer test-secret"}
    ).status_code == 200


def test_problem_query_reports_total_and_page_metadata():
    for index in range(3):
        assert sync_problem(f"page-{index}", accepted=True).status_code == 200

    response = client.get("/api/problems?limit=2&offset=1")
    assert response.status_code == 200
    assert response.json()["count"] == 3
    assert response.json()["limit"] == 2
    assert response.json()["offset"] == 1
    assert len(response.json()["items"]) == 2


def test_topic_update_and_case_normalized_filter():
    sync_problem("topic-filter")
    problem_id = client.get("/api/problems").json()["items"][0]["id"]

    updated = client.put(
        f"/api/problems/{problem_id}/topics", json={"topics": ["dp", "ARRAY"]}
    )
    assert updated.status_code == 200
    assert updated.json()["custom_topics"] == ["Dynamic Programming", "Arrays"]

    filtered = client.get("/api/problems?topic=dp").json()
    assert filtered["count"] == 1
    assert filtered["items"][0]["slug"] == "topic-filter"


def test_equivalent_problem_group_propagates_solved_status():
    sync_problem("equivalent-solved", accepted=True)
    sync_problem("equivalent-open", accepted=False)
    items = client.get("/api/problems").json()["items"]
    ids = [item["id"] for item in items]

    linked = client.post("/api/equivalence-groups", json={"problem_ids": ids})
    assert linked.status_code == 200

    resolved = client.get(
        "/api/problems/resolve",
        params={"url": "https://leetcode.com/problems/equivalent-open/"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["solved"] is False
    assert resolved.json()["group_solved"] is True


def test_invalid_problem_urls_and_limits_are_rejected():
    assert client.get(
        "/api/problems/resolve", params={"url": "https://example.com/problem"}
    ).status_code == 422
    assert client.get("/api/problems?limit=0").status_code == 422
    assert client.get("/api/problems?offset=-1").status_code == 422


def test_zerotrac_import_upserts_dataset(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return [
                {
                    "TitleSlug": "two-sum",
                    "Title": "Two Sum",
                    "ID": 1,
                    "Rating": 1200.4,
                    "ContestSlug": "weekly-1",
                    "ProblemIndex": "A",
                }
            ]

    monkeypatch.setattr(sync_router.httpx, "get", lambda *args, **kwargs: FakeResponse())

    response = client.post("/api/import/zerotrac")
    assert response.status_code == 200
    assert response.json()["imported"] == 1
    problem = client.get("/api/problems").json()["items"][0]
    assert problem["rating"] == 1200
    assert problem["contest"] == "weekly-1"

def test_production_configuration_fails_closed():
    import pytest

    with pytest.raises(RuntimeError, match="at least 32 characters"):
        validate_runtime_configuration(
            "production", "short", ["https://app.example.com"]
        )
    with pytest.raises(RuntimeError, match="Wildcard CORS"):
        validate_runtime_configuration(
            "production", "x" * 32, ["*"]
        )
    validate_runtime_configuration(
        "production",
        "x" * 32,
        ["https://app.example.com"],
    )


def test_authenticated_verification_endpoint(monkeypatch):
    monkeypatch.setenv("TRACKER_TOKEN", "verification-secret")
    assert client.get("/api/auth/verify").status_code == 401
    verified = client.get(
        "/api/auth/verify", headers={"X-Tracker-Token": "verification-secret"}
    )
    assert verified.status_code == 200
    assert verified.json() == {"authenticated": True}


def test_sync_replaces_untrusted_urls_with_canonical_platform_url():
    response = client.post(
        "/api/sync/leetcode",
        json={
            "problems": [
                {
                    "slug": "safe-link",
                    "title": "Safe Link",
                    "url": "javascript:alert(1)",
                    "accepted": True,
                }
            ]
        },
    )
    assert response.status_code == 200
    problem = client.get("/api/problems").json()["items"][0]
    assert problem["url"] == "https://leetcode.com/problems/safe-link/"


def test_security_headers_are_present():
    response = client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
