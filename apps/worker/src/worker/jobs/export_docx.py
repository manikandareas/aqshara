from __future__ import annotations

from typing import Any

from worker.jobs.common import (
    RetryableJobError,
    UnrecoverableJobError,
    failure_strategy,
)
from worker.jobs.render_docx import render_document_value_to_docx_bytes

DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class ExportDocxProcessor:
    def __init__(self, repository: Any, storage: Any, events: Any) -> None:
        self._repository = repository
        self._storage = storage
        self._events = events

    def process(
        self,
        payload: dict[str, object],
        *,
        job_id: str,
        attempts_made: int,
        max_attempts: int,
    ) -> None:
        row = self._repository.get_export_job_row(str(payload["exportId"]))
        final_attempt = attempts_made + 1 >= max(1, max_attempts)

        if not row:
            self._emit_failure(
                payload,
                job_id=job_id,
                code="export_not_found",
                message=f"Export {payload['exportId']} not found",
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                terminal=True,
                will_retry=False,
            )
            raise UnrecoverableJobError(f"Export {payload['exportId']} not found")

        if (
            row["user_id"] != payload["userId"]
            or row["document_id"] != payload["documentId"]
            or row["workspace_id"] != payload["workspaceId"]
        ):
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="payload_mismatch",
                error_message="Job payload does not match export record",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
            )

        if row["status"] == "ready":
            return

        started = self._repository.mark_processing(str(payload["exportId"]), job_id)
        if not started:
            again = self._repository.get_export_job_row(str(payload["exportId"]))
            if again and again["status"] == "ready":
                return
            if again and again["status"] == "processing" and again["bullmq_job_id"] == job_id:
                pass
            elif again and again["status"] == "processing":
                return
            message = f"Could not move export {payload['exportId']} to processing"
            self._emit_failure(
                payload,
                job_id=job_id,
                code="processing_transition_failed",
                message=message,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                terminal=final_attempt,
                will_retry=not final_attempt,
            )
            if final_attempt:
                self._repository.mark_failed(
                    str(payload["exportId"]),
                    error_code="processing_transition_failed",
                    error_message=message,
                )
                raise UnrecoverableJobError(message)
            raise RetryableJobError(message)

        document = self._repository.get_document(str(payload["documentId"]))
        if not document:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="document_missing",
                error_message="Document not found",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
            )

        try:
            buffer = render_document_value_to_docx_bytes(
                title=str(document["title"]),
                value=list(document["content_json"]),
            )
            storage_key = self._storage.create_export_key(
                str(payload["userId"]),
                str(payload["exportId"]),
            )
            self._storage.write_export_file(storage_key, buffer)
            ready = self._repository.mark_ready(
                str(payload["exportId"]),
                storage_key=storage_key,
                content_type=DOCX_CONTENT_TYPE,
                file_size_bytes=len(buffer),
            )
            if not ready.get("ok"):
                self._fail_job(
                    payload,
                    job_id=job_id,
                    error_code="ready_transition_failed",
                    error_message="Could not finalize export as ready",
                    retryable=False,
                    attempts_made=attempts_made,
                    max_attempts=max_attempts,
                )
            self._events.log_launch_event(
                "export.docx_ready",
                {
                    "exportId": payload["exportId"],
                    "userId": payload["userId"],
                    "documentId": payload["documentId"],
                    "fileSizeBytes": len(buffer),
                },
            )
        except (RetryableJobError, UnrecoverableJobError):
            raise
        except Exception as error:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="export_render_failed",
                error_message=str(error)[:2000],
                retryable=True,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
            )

    def _fail_job(
        self,
        payload: dict[str, object],
        *,
        job_id: str,
        error_code: str,
        error_message: str,
        retryable: bool,
        attempts_made: int,
        max_attempts: int,
    ) -> None:
        strategy = failure_strategy(
            retryable=retryable,
            attempts_made=attempts_made,
            max_attempts=max_attempts,
        )
        self._emit_failure(
            payload,
            job_id=job_id,
            code=error_code,
            message=error_message,
            attempts_made=attempts_made,
            max_attempts=max_attempts,
            terminal=strategy["mark_failed"] or strategy["unrecoverable"],
            will_retry=retryable and not (strategy["mark_failed"] or strategy["unrecoverable"]),
        )
        if strategy["mark_failed"]:
            self._repository.mark_failed(
                str(payload["exportId"]),
                error_code=error_code,
                error_message=error_message,
            )
            self._events.log_launch_event(
                "export.docx_failed",
                {
                    "exportId": payload["exportId"],
                    "userId": payload["userId"],
                    "documentId": payload["documentId"],
                    "errorCode": error_code,
                    "attemptsMade": attempts_made + 1,
                    "maxAttempts": max_attempts,
                },
            )
        if strategy["unrecoverable"]:
            raise UnrecoverableJobError(error_message)
        raise RetryableJobError(error_message)

    def _emit_failure(
        self,
        payload: dict[str, object],
        *,
        job_id: str,
        code: str,
        message: str,
        attempts_made: int,
        max_attempts: int,
        terminal: bool,
        will_retry: bool,
    ) -> None:
        self._events.log_error_event(
            {
                "domain": "worker",
                "failureClass": "system",
                "code": code,
                "jobId": job_id,
                "exportId": payload["exportId"],
                "documentId": payload["documentId"],
                "userId": payload["userId"],
                "workspaceId": payload["workspaceId"],
                "message": message,
                "attemptNumber": attempts_made + 1,
                "maxAttempts": max_attempts,
                "terminal": terminal,
                "willRetry": will_retry,
                "workerJob": "export_docx",
            }
        )


__all__ = ["ExportDocxProcessor", "RetryableJobError", "UnrecoverableJobError"]
