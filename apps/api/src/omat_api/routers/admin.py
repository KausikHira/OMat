"""Admin: trigger ingest jobs and poll their status.

v1 keeps jobs in-process (single API task); the Kafka path in phase 2 swaps
this dict for a job table in Postgres behind the same interface.
"""

from __future__ import annotations

import subprocess
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/admin", tags=["admin"])

_jobs: dict[str, dict[str, Any]] = {}


@router.post("/ingest")
async def start_ingest(csv_path: str = "data/final_data.csv") -> dict[str, Any]:
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {"status": "running", "started": time.time(), "csv": csv_path}
    process = subprocess.Popen(
        [".venv/bin/python", "-m", "omat_ingest.cli", "index", csv_path],
        cwd=".",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    _jobs[job_id]["pid"] = process.pid

    async def _await_completion() -> None:
        returncode = await _wait_async(process)
        job = _jobs[job_id]
        job["status"] = "done" if returncode == 0 else "failed"
        job["finished"] = time.time()

    import asyncio
    asyncio.create_task(_await_completion())
    return {"job_id": job_id, "status": "running"}


async def _wait_async(process: subprocess.Popen) -> int:
    import asyncio

    while process.poll() is None:
        await asyncio.sleep(1.0)
    return process.returncode or 0


@router.get("/jobs/{job_id}")
async def job_status(job_id: str) -> dict[str, Any]:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "unknown job")
    return {**job, "elapsed_s": round(time.time() - job["started"], 1)}
