from fastapi import APIRouter, Depends, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..security import require_token

router = APIRouter()


@router.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "trackforge", "time": utcnow()}


@router.get("/api/ready")
def readiness(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok", "time": utcnow()}


@router.get("/api/auth/verify", dependencies=[Depends(require_token)])
def verify_auth() -> dict:
    return {"authenticated": True}


@router.get("/metrics", dependencies=[Depends(require_token)], include_in_schema=False)
def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)