from fastapi import APIRouter, Depends

from ..database import utcnow
from ..security import require_token

router = APIRouter()


@router.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "trackforge", "time": utcnow()}


@router.get("/api/auth/verify", dependencies=[Depends(require_token)])
def verify_auth() -> dict:
    return {"authenticated": True}