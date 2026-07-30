from __future__ import annotations

import secrets

from fastapi import Header, HTTPException

from .config import get_settings


def require_token(
    x_tracker_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    configured = get_settings().tracker_token.strip()
    if not configured:
        return
    supplied = x_tracker_token
    if not supplied and authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:]
    if not supplied or not secrets.compare_digest(supplied, configured):
        raise HTTPException(status_code=401, detail="Invalid tracker token")