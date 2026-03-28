from __future__ import annotations

import pytest

from worker.config import load_settings


def _base_env() -> dict[str, str]:
    return {
        "DATABASE_URL": "postgres://postgres:postgres@localhost:5432/aqshara",
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": "6379",
        "WORKER_PROXY_BASE_URL": "http://localhost:8080",
        "WORKER_PUBLIC_BASE_URL": "http://localhost:8100",
    }


def test_requires_r2_when_mistral_is_enabled() -> None:
    env = _base_env() | {"MISTRAL_API_KEY": "mistral-key"}

    with pytest.raises(
        ValueError,
        match="MISTRAL_API_KEY requires R2 object storage",
    ):
        load_settings(env)


def test_parses_worker_runtime_defaults() -> None:
    settings = load_settings(_base_env())

    assert settings.worker_recovery_stale_ms == 15 * 60 * 1000
    assert settings.mistral_ocr_timeout_ms == 45 * 1000
    assert settings.worker_export_concurrency == 4
    assert settings.worker_source_concurrency == 2
