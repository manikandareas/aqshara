from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from requests import RequestException

from worker.api import register_health_routes
from worker.config import Settings, load_settings
from worker.contracts import (
    ExportDocxJobRequest,
    ParseSourceJobRequest,
)
from worker.db.connection import Database
from worker.jobs.common import RetryableJobError, UnrecoverableJobError
from worker.runtime.dependencies import build_runtime
from worker.runtime.proxy import sync_proxy_workers
from worker.runtime.recovery import reconcile_stuck_jobs


def create_app(
    *,
    settings: Settings | None = None,
    export_processor: Any | None = None,
    parse_processor: Any | None = None,
    startup_hooks: dict[str, Any] | None = None,
) -> FastAPI:
    resolved_settings = settings or load_settings()
    if export_processor is None or parse_processor is None:
        default_export, default_parse = build_runtime(resolved_settings)
        export_processor = export_processor or default_export
        parse_processor = parse_processor or default_parse
    hooks = startup_hooks or {}
    reconcile = hooks.get("reconcile")
    sync_proxy = hooks.get("sync_proxy")
    warn = hooks.get("warn")

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> Any:
        if reconcile is not None:
            reconcile()
        else:
            database = Database(resolved_settings.database_url)
            reconcile_stuck_jobs(
                database,
                recovery_stale_ms=resolved_settings.worker_recovery_stale_ms,
            )
        try:
            if sync_proxy is not None:
                sync_proxy()
            else:
                sync_proxy_workers(resolved_settings)
        except (RequestException, ConnectionError) as error:
            if resolved_settings.production_like:
                raise
            warning_fields = {
                "proxyBaseUrl": str(resolved_settings.worker_proxy_base_url),
                "error": str(error),
            }
            if warn is not None:
                warn("BullMQ Proxy unavailable during startup; continuing without sync", warning_fields)
            else:
                print(
                    "[worker] BullMQ Proxy unavailable during startup; continuing without sync",
                    warning_fields,
                )
        yield

    app = FastAPI(title="worker", lifespan=lifespan)
    router = app.router
    register_health_routes(router)

    @app.post("/internal/jobs/export_docx", status_code=204)
    def process_export_job(request: ExportDocxJobRequest) -> Response:
        try:
            export_processor.process(
                request.job.data.model_dump(by_alias=True),
                job_id=request.job.id,
                attempts_made=request.job.attempts_made,
                max_attempts=request.job.opts.attempts,
            )
        except RetryableJobError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except UnrecoverableJobError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error
        return Response(status_code=204)

    @app.post("/internal/jobs/parse_source", status_code=204)
    def process_parse_job(request: ParseSourceJobRequest) -> Response:
        try:
            parse_processor.process(
                request.job.data.model_dump(by_alias=True),
                job_id=request.job.id,
                attempts_made=request.job.attempts_made,
                max_attempts=request.job.opts.attempts,
            )
        except RetryableJobError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except UnrecoverableJobError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error
        return Response(status_code=204)

    return app
