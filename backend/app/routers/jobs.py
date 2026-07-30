from __future__ import annotations

import json
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db, utcnow
from ..models import ImportJob
from ..observability import IMPORT_JOBS
from ..security import require_token

router = APIRouter(prefix="/api/jobs", dependencies=[Depends(require_token)])
logger = logging.getLogger(__name__)
recovery_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="trackforge-import")


def is_serverless_runtime() -> bool:
    return os.getenv("VERCEL") == "1"


def serialize_job(job: ImportJob, *, deduplicated: bool = False) -> dict:
    return {
        "id": job.id,
        "kind": job.kind,
        "status": job.status,
        "result": json.loads(job.result_json) if job.result_json else None,
        "error": job.error,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "deduplicated": deduplicated,
    }


def execute_import_job(job_id: str, kind: str) -> None:
    from .sync import import_leetcode_catalog, import_zerotrac

    db = SessionLocal()
    try:
        job = db.get(ImportJob, job_id)
        if not job:
            return
        job.status = "running"
        job.started_at = utcnow()
        db.commit()
        logger.info("import job started", extra={"job_id": job_id, "kind": kind})

        result = import_zerotrac(db) if kind == "zerotrac" else import_leetcode_catalog(db)
        job = db.get(ImportJob, job_id)
        job.status = "succeeded"
        job.result_json = json.dumps(result)
        job.finished_at = utcnow()
        db.commit()
        IMPORT_JOBS.labels(kind=kind, status="succeeded").inc()
        logger.info("import job succeeded", extra={"job_id": job_id, "kind": kind})
    except Exception as exc:
        db.rollback()
        job = db.get(ImportJob, job_id)
        if job:
            job.status = "failed"
            job.error = str(exc)[:2000]
            job.finished_at = utcnow()
            db.commit()
        IMPORT_JOBS.labels(kind=kind, status="failed").inc()
        logger.exception("import job failed", extra={"job_id": job_id, "kind": kind})
    finally:
        db.close()


def recover_incomplete_jobs() -> int:
    db = SessionLocal()
    try:
        active = db.scalars(
            select(ImportJob).where(ImportJob.status.in_(["queued", "running"]))
        ).all()
        for job in active:
            job.status = "queued"
            job.error = None
        db.commit()
        for job in active:
            if is_serverless_runtime():
                execute_import_job(job.id, job.kind)
            else:
                recovery_executor.submit(execute_import_job, job.id, job.kind)
        return len(active)
    finally:
        db.close()


@router.post("/import/{kind}", status_code=status.HTTP_202_ACCEPTED)
def queue_import(
    kind: Literal["zerotrac", "leetcode-catalog"],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    active = db.scalar(
        select(ImportJob)
        .where(ImportJob.kind == kind, ImportJob.status.in_(["queued", "running"]))
        .order_by(ImportJob.created_at.desc())
    )
    if active:
        return serialize_job(active, deduplicated=True)

    job = ImportJob(id=str(uuid.uuid4()), kind=kind, status="queued")
    db.add(job)
    db.commit()
    if is_serverless_runtime():
        execute_import_job(job.id, kind)
        db.refresh(job)
    else:
        background_tasks.add_task(execute_import_job, job.id, kind)
    return serialize_job(job)


@router.get("/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    job = db.get(ImportJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return serialize_job(job)
