from __future__ import annotations

import argparse
import statistics
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed


def run_request(base_url: str, token: str) -> tuple[float, int]:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/summary",
        headers={"X-Tracker-Token": token} if token else {},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return time.perf_counter() - started, response.status
    except Exception:
        return time.perf_counter() - started, 0


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0
    index = min(len(values) - 1, round((len(values) - 1) * percentile_value))
    return sorted(values)[index]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a bounded TrackForge load smoke test")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--token", default="")
    parser.add_argument("--requests", type=int, default=200)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--max-p95-ms", type=float, default=750)
    args = parser.parse_args()

    results = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(run_request, args.base_url, args.token)
            for _ in range(args.requests)
        ]
        for future in as_completed(futures):
            results.append(future.result())

    durations = [duration for duration, _ in results]
    failures = sum(1 for _, status in results if status != 200)
    p95_ms = percentile(durations, 0.95) * 1000
    print(
        f"requests={len(results)} failures={failures} "
        f"mean_ms={statistics.mean(durations) * 1000:.1f} p95_ms={p95_ms:.1f}"
    )
    return 1 if failures or p95_ms > args.max_p95_ms else 0


if __name__ == "__main__":
    raise SystemExit(main())