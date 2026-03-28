from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from worker.contracts import HealthResponse


def register_health_routes(router: APIRouter) -> None:
    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            ok=True,
            service="worker",
            timestamp=datetime.now(tz=UTC).isoformat(),
        )

    @router.get("/readiness", response_model=HealthResponse)
    def readiness() -> HealthResponse:
        dependencies = {
            "postgres": True,
            "redis": True,
            "storage": True,
            "proxy": True,
        }
        return HealthResponse(
            ok=all(dependencies.values()),
            service="worker",
            timestamp=datetime.now(tz=UTC).isoformat(),
            dependencies=dependencies,
        )
