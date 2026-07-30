import httpx

from app import http_client


def test_request_json_retries_retryable_status(monkeypatch):
    attempts = []

    class FakeClient:
        def request(self, method, url, **kwargs):
            attempts.append((method, url))
            status = 503 if len(attempts) < 3 else 200
            return httpx.Response(
                status,
                json={"ok": status == 200},
                request=httpx.Request(method, url),
            )

    monkeypatch.setattr(http_client.time, "sleep", lambda _: None)
    payload = http_client.request_json(FakeClient(), "GET", "https://example.com/data")
    assert payload == {"ok": True}
    assert len(attempts) == 3