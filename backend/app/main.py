from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings, validate_runtime_configuration
from .routers import problems, recommendations, sync, system


def create_app() -> FastAPI:
    settings = get_settings()
    origins = settings.cors_origin_list
    validate_runtime_configuration(
        settings.environment,
        settings.tracker_token,
        origins,
    )

    application = FastAPI(
        title="TrackForge API",
        version="1.0.0",
        description="Personal LeetCode, GFG, and ZeroTrac progress tracker.",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Tracker-Token"],
    )

    @application.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

    application.include_router(system.router)
    application.include_router(problems.router)
    application.include_router(sync.router)
    application.include_router(recommendations.router)
    return application


app = create_app()