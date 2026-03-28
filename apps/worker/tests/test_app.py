from __future__ import annotations

from fastapi.testclient import TestClient

from worker.app import create_app
from worker.config import load_settings


class _FakeProcessor:
    def __init__(self) -> None:
        self.calls: list[tuple[dict[str, object], str, int, int]] = []

    def process(
        self,
        payload: dict[str, object],
        *,
        job_id: str,
        attempts_made: int,
        max_attempts: int,
    ) -> None:
        self.calls.append((payload, job_id, attempts_made, max_attempts))


def test_health_endpoint_reports_worker_service() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["service"] == "worker"


def test_export_endpoint_validates_payload_and_dispatches() -> None:
    export_processor = _FakeProcessor()
    parse_processor = _FakeProcessor()
    app = create_app(
        export_processor=export_processor,
        parse_processor=parse_processor,
    )
    client = TestClient(app)

    response = client.post(
        "/internal/jobs/export_docx",
        json={
            "job": {
                "id": "job-1",
                "name": "export_docx",
                "data": {
                    "exportId": "exp-1",
                    "documentId": "doc-1",
                    "userId": "user-1",
                    "workspaceId": "ws-1",
                    "idempotencyKey": "idem-1",
                },
                "attemptsMade": 0,
                "opts": {"attempts": 3},
            }
        },
    )

    assert response.status_code == 204
    assert export_processor.calls == [
        (
            {
                "exportId": "exp-1",
                "documentId": "doc-1",
                "userId": "user-1",
                "workspaceId": "ws-1",
                "idempotencyKey": "idem-1",
            },
            "job-1",
            0,
            3,
        )
    ]
    assert parse_processor.calls == []


def test_export_endpoint_rejects_invalid_payload() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.post(
        "/internal/jobs/export_docx",
        json={"job": {"id": "job-1", "name": "export_docx", "data": {}}},
    )

    assert response.status_code == 422


def test_app_startup_continues_when_proxy_sync_fails_in_development() -> None:
    settings = load_settings(
        {
            "DATABASE_URL": "postgres://postgres:postgres@localhost:5432/aqshara",
            "REDIS_HOST": "127.0.0.1",
            "REDIS_PORT": "6379",
            "WORKER_PROXY_BASE_URL": "http://localhost:8080",
            "WORKER_PUBLIC_BASE_URL": "http://localhost:8100",
            "NODE_ENV": "development",
        }
    )
    app = create_app(
        settings=settings,
        export_processor=_FakeProcessor(),
        parse_processor=_FakeProcessor(),
        startup_hooks={
            "reconcile": lambda: None,
            "sync_proxy": lambda: (_ for _ in ()).throw(ConnectionError("proxy down")),
            "warn": lambda _message, _fields=None: None,
        },
    )

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200


def test_app_startup_fails_when_proxy_sync_fails_in_production() -> None:
    settings = load_settings(
        {
            "DATABASE_URL": "postgres://postgres:postgres@localhost:5432/aqshara",
            "REDIS_HOST": "127.0.0.1",
            "REDIS_PORT": "6379",
            "WORKER_PROXY_BASE_URL": "http://localhost:8080",
            "WORKER_PUBLIC_BASE_URL": "http://localhost:8100",
            "NODE_ENV": "production",
            "R2_ACCOUNT_ID": "acct",
            "R2_ACCESS_KEY_ID": "key",
            "R2_SECRET_ACCESS_KEY": "secret",
            "R2_BUCKET": "bucket",
        }
    )
    app = create_app(
        settings=settings,
        export_processor=_FakeProcessor(),
        parse_processor=_FakeProcessor(),
        startup_hooks={
            "reconcile": lambda: None,
            "sync_proxy": lambda: (_ for _ in ()).throw(ConnectionError("proxy down")),
            "warn": lambda _message, _fields=None: None,
        },
    )

    try:
        with TestClient(app):
            raise AssertionError("startup should have failed")
    except ConnectionError as error:
        assert "proxy down" in str(error)
