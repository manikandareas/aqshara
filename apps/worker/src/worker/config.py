from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class Settings(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    node_env: str = "development"
    database_url: str
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket: str | None = None
    mistral_api_key: str | None = None
    mistral_api_base_url: HttpUrl = Field(default="https://api.mistral.ai")
    aqshara_exports_dir: Path = Field(default_factory=lambda: Path.cwd() / ".data" / "exports")
    aqshara_sources_dir: Path = Field(default_factory=lambda: Path.cwd() / ".data" / "sources")
    aqshara_log_format: str | None = None
    worker_recovery_stale_ms: int = 15 * 60 * 1000
    mistral_ocr_timeout_ms: int = 45 * 1000
    worker_proxy_base_url: HttpUrl = Field(default="http://localhost:8080")
    worker_proxy_token: str | None = None
    worker_public_base_url: HttpUrl = Field(default="http://localhost:8100")
    worker_proxy_timeout_ms: int = 60 * 1000
    worker_proxy_sync_enabled: bool = True
    worker_export_concurrency: int = 4
    worker_source_concurrency: int = 2

    @field_validator(
        "worker_recovery_stale_ms",
        "mistral_ocr_timeout_ms",
        "worker_proxy_timeout_ms",
        "worker_export_concurrency",
        "worker_source_concurrency",
    )
    @classmethod
    def _validate_positive_integer(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("must be a positive integer")
        return value

    @property
    def r2_configured(self) -> bool:
        return all(
            [
                self.r2_account_id,
                self.r2_access_key_id,
                self.r2_secret_access_key,
                self.r2_bucket,
            ]
        )

    @property
    def production_like(self) -> bool:
        return self.node_env == "production"

    @property
    def mistral_enabled(self) -> bool:
        return bool((self.mistral_api_key or "").strip())

    @property
    def r2_endpoint(self) -> str:
        if not self.r2_account_id:
            raise ValueError("R2 account id is not configured")
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    source = env if env is not None else {}
    if not source:
      import os

      source = os.environ

    settings = Settings(
        node_env=source.get("NODE_ENV", "development"),
        database_url=source.get(
            "DATABASE_URL",
            "postgres://postgres:postgres@localhost:5432/aqshara",
        ),
        redis_host=source.get("REDIS_HOST", "127.0.0.1"),
        redis_port=int(source.get("REDIS_PORT", "6379")),
        r2_account_id=source.get("R2_ACCOUNT_ID"),
        r2_access_key_id=source.get("R2_ACCESS_KEY_ID"),
        r2_secret_access_key=source.get("R2_SECRET_ACCESS_KEY"),
        r2_bucket=source.get("R2_BUCKET"),
        mistral_api_key=source.get("MISTRAL_API_KEY"),
        mistral_api_base_url=source.get(
            "MISTRAL_API_BASE_URL",
            "https://api.mistral.ai",
        ),
        aqshara_exports_dir=Path(
            source.get(
                "AQSHARA_EXPORTS_DIR",
                str(Path.cwd() / ".data" / "exports"),
            )
        ),
        aqshara_sources_dir=Path(
            source.get(
                "AQSHARA_SOURCES_DIR",
                str(Path.cwd() / ".data" / "sources"),
            )
        ),
        aqshara_log_format=source.get("AQSHARA_LOG_FORMAT"),
        worker_recovery_stale_ms=int(
            source.get("WORKER_RECOVERY_STALE_MS", str(15 * 60 * 1000))
        ),
        mistral_ocr_timeout_ms=int(
            source.get("MISTRAL_OCR_TIMEOUT_MS", str(45 * 1000))
        ),
        worker_proxy_base_url=source.get(
            "WORKER_PROXY_BASE_URL",
            "http://localhost:8080",
        ),
        worker_proxy_token=source.get("WORKER_PROXY_TOKEN"),
        worker_public_base_url=source.get(
            "WORKER_PUBLIC_BASE_URL",
            "http://localhost:8100",
        ),
        worker_proxy_timeout_ms=int(
            source.get("WORKER_PROXY_TIMEOUT_MS", str(60 * 1000))
        ),
        worker_proxy_sync_enabled=source.get(
            "WORKER_PROXY_SYNC_ENABLED",
            "true",
        ).lower()
        not in {"false", "0", "no"},
        worker_export_concurrency=int(
            source.get("WORKER_EXPORT_CONCURRENCY", "4")
        ),
        worker_source_concurrency=int(
            source.get("WORKER_SOURCE_CONCURRENCY", "2")
        ),
    )

    if settings.production_like and not settings.r2_configured:
        raise ValueError(
            "Worker requires R2 object storage in production to avoid local-storage fallback"
        )

    if settings.mistral_enabled and not settings.r2_configured:
        raise ValueError(
            "MISTRAL_API_KEY requires R2 object storage so OCR can access uploaded source files"
        )

    return settings
