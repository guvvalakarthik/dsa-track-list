from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings, validate_runtime_configuration
from .observability import REQUEST_COUNT, REQUEST_DURATION, configure_logging
from .routers import jobs, problems, recommendations, sync, system


@asynccontextmanager
async def lifespan(application: FastAPI):
    jobs.recover_incomplete_jobs()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    origins = settings.cors_origin_list
    validate_runtime_configuration(
        settings.environment,
        settings.tracker_token,
        origins,
    )
    configure_logging(settings.log_level)
    logger = logging.getLogger("trackforge.request")

    application = FastAPI(
        title="TrackForge API",
        version="1.0.0",
        description="Personal LeetCode, GFG, and ZeroTrac progress tracker.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Tracker-Token"],
        expose_headers=["X-Request-ID"],
    )

    @application.middleware("http")
    async def request_observability(request: Request, call_next):
        supplied_request_id = request.headers.get("X-Request-ID", "")
        request_id = (
            supplied_request_id
            if supplied_request_id and len(supplied_request_id) <= 128
            else str(uuid.uuid4())
        )
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
            return response
        finally:
            duration = time.perf_counter() - started
            route = request.scope.get("route")
            route_path = getattr(route, "path", request.url.path)
            REQUEST_COUNT.labels(
                method=request.method,
                route=route_path,
                status=str(status_code),
            ).inc()
            REQUEST_DURATION.labels(method=request.method, route=route_path).observe(duration)
            logger.info(
                "request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "route": route_path,
                    "status": status_code,
                    "duration_ms": round(duration * 1000, 2),
                },
            )

    application.include_router(system.router)
    application.include_router(problems.router)
    application.include_router(sync.router)
    application.include_router(recommendations.router)
    application.include_router(jobs.router)
    return application


app = create_app()