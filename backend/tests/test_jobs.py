from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import ImportJob
from app.routers import sync as sync_router

client = TestClient(app)


def test_persistent_import_job_completes(monkeypatch):
    payload = [{"TitleSlug": "job-problem", "Title": "Job Problem", "Rating": 1337}]
    monkeypatch.setattr(sync_router, "request_json", lambda *args, **kwargs: payload)

    queued = client.post("/api/jobs/import/zerotrac")
    assert queued.status_code == 202
    assert queued.json()["status"] == "queued"

    completed = client.get(f"/api/jobs/{queued.json()['id']}")
    assert completed.status_code == 200
    assert completed.json()["status"] == "succeeded"
    assert completed.json()["result"]["imported"] == 1


def test_import_job_deduplicates_active_work():
    db = SessionLocal()
    existing = ImportJob(id="active-job", kind="zerotrac", status="running")
    db.add(existing)
    db.commit()
    db.close()

    response = client.post("/api/jobs/import/zerotrac")
    assert response.status_code == 202
    assert response.json()["id"] == "active-job"
    assert response.json()["deduplicated"] is True


def test_import_job_records_failures(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(sync_router, "request_json", fail)
    queued = client.post("/api/jobs/import/zerotrac").json()
    failed = client.get(f"/api/jobs/{queued['id']}").json()
    assert failed["status"] == "failed"
    assert "upstream unavailable" in failed["error"]


def test_missing_import_job_returns_404():
    assert client.get("/api/jobs/does-not-exist").status_code == 404