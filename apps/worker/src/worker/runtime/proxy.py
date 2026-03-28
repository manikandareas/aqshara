from __future__ import annotations

from typing import Any

import requests

from worker.config import Settings


def sync_proxy_workers(settings: Settings) -> None:
    if not settings.worker_proxy_sync_enabled:
        return
    headers = {"Content-Type": "application/json"}
    if settings.worker_proxy_token:
        headers["Authorization"] = f"Bearer {settings.worker_proxy_token}"
    base_url = str(settings.worker_proxy_base_url).rstrip("/")
    workers: list[dict[str, Any]] = [
        {
            "queue": "export_docx",
            "opts": {"concurrency": settings.worker_export_concurrency},
            "endpoint": {
                "url": f"{str(settings.worker_public_base_url).rstrip('/')}/internal/jobs/export_docx",
                "method": "post",
                "timeout": settings.worker_proxy_timeout_ms,
            },
        },
        {
            "queue": "parse_source",
            "opts": {"concurrency": settings.worker_source_concurrency},
            "endpoint": {
                "url": f"{str(settings.worker_public_base_url).rstrip('/')}/internal/jobs/parse_source",
                "method": "post",
                "timeout": settings.worker_proxy_timeout_ms,
            },
        },
    ]
    for worker in workers:
        response = requests.post(
            f"{base_url}/workers",
            headers=headers,
            json=worker,
            timeout=settings.worker_proxy_timeout_ms / 1000,
        )
        response.raise_for_status()
