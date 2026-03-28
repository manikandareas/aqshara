from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any


class Logger:
    def __init__(self, scope: str, *, json_logs: bool = False) -> None:
        self._scope = scope
        self._json_logs = json_logs

    def info(self, message: str, fields: dict[str, Any] | None = None) -> None:
        self._emit("info", message, None, fields)

    def warn(self, message: str, fields: dict[str, Any] | None = None) -> None:
        self._emit("warn", message, None, fields)

    def error(
        self,
        message: str,
        error: Exception | None = None,
        fields: dict[str, Any] | None = None,
    ) -> None:
        payload = fields.copy() if fields else {}
        if error is not None:
            payload.update({"errName": type(error).__name__, "errMessage": str(error)})
        self._emit("error", message, None, payload)

    def _emit(
        self,
        level: str,
        message: str,
        _: Exception | None,
        fields: dict[str, Any] | None,
    ) -> None:
        if self._json_logs:
            print(json.dumps({"level": level, "scope": self._scope, "message": message, **(fields or {})}))
            return
        if fields:
            print(f"[{self._scope}] {message}", fields)
            return
        print(f"[{self._scope}] {message}")


def create_logger(scope: str, *, json_logs: bool = False) -> Logger:
    return Logger(scope, json_logs=json_logs)


def _utc_timestamp() -> str:
    return datetime.now(tz=UTC).isoformat()


def log_launch_event(event: str, fields: dict[str, Any] | None = None) -> None:
    print(json.dumps({"type": "launch_event", "event": event, "ts": _utc_timestamp(), **(fields or {})}))


def log_error_event(fields: dict[str, Any]) -> None:
    print(json.dumps({"type": "error_event", "ts": _utc_timestamp(), **fields}))
