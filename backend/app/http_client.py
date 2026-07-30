from __future__ import annotations

import time
from typing import Any

import httpx

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def build_http_client(timeout: float = 30) -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(timeout, connect=5),
        follow_redirects=True,
        transport=httpx.HTTPTransport(retries=2),
        headers={"User-Agent": "TrackForge/1.0 (+https://github.com/guvvalakarthik/dsa-track-list)"},
    )


def request_json(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    attempts: int = 3,
    **kwargs: Any,
) -> Any:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = client.request(method, url, **kwargs)
            if response.status_code in RETRYABLE_STATUS_CODES and attempt < attempts - 1:
                time.sleep(0.25 * (2**attempt))
                continue
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as exc:
            last_error = exc
            if attempt >= attempts - 1:
                raise
            time.sleep(0.25 * (2**attempt))
    if last_error:
        raise last_error
    raise RuntimeError("External request failed without a response")