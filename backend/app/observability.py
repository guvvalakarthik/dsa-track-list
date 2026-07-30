from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter(
    "trackforge_http_requests_total",
    "HTTP requests handled by TrackForge",
    ["method", "route", "status"],
)
REQUEST_DURATION = Histogram(
    "trackforge_http_request_duration_seconds",
    "TrackForge HTTP request duration",
    ["method", "route"],
)
IMPORT_JOBS = Counter(
    "trackforge_import_jobs_total",
    "Persistent import job outcomes",
    ["kind", "status"],
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_id", "method", "route", "status", "duration_ms", "job_id", "kind"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())