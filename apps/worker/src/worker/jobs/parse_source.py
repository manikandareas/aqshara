from __future__ import annotations

import hashlib
from typing import Any

from worker.jobs.common import (
    RetryableJobError,
    UnrecoverableJobError,
    failure_strategy,
)

PARSED_TEXT_CONTENT_TYPE = "text/plain; charset=utf-8"
MAX_SOURCE_PAGES = 300


class ParseSourceProcessor:
    def __init__(
        self,
        *,
        repository: Any,
        storage: Any,
        pdf_extractor: Any,
        ocr_client: Any,
        events: Any,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._pdf_extractor = pdf_extractor
        self._ocr_client = ocr_client
        self._events = events

    def process(
        self,
        payload: dict[str, object],
        *,
        job_id: str,
        attempts_made: int,
        max_attempts: int,
    ) -> None:
        row = self._repository.get_source_job_row(str(payload["sourceId"]))
        final_attempt = attempts_made + 1 >= max(1, max_attempts)

        if not row:
            self._emit_failure(
                payload,
                job_id=job_id,
                code="source_not_found",
                message=f"Source {payload['sourceId']} not found",
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                terminal=True,
                will_retry=False,
            )
            raise UnrecoverableJobError(f"Source {payload['sourceId']} not found")

        if row["user_id"] != payload["userId"] or row["workspace_id"] != payload["workspaceId"]:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="payload_mismatch",
                error_message="Job payload does not match source record",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
            )

        if row["status"] == "ready":
            return

        document = self._repository.get_document_row(str(payload["documentId"]))
        if not document or document["workspace_id"] != row["workspace_id"]:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="document_workspace_mismatch",
                error_message="Document not found for source workspace",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                failure_class="user",
            )

        link = self._repository.get_document_source_link_row(
            str(payload["sourceId"]),
            str(payload["documentId"]),
        )
        if not link:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="source_link_missing",
                error_message="Source is not linked to the document in job payload",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                failure_class="user",
            )

        started = self._repository.mark_processing(str(payload["sourceId"]), job_id)
        if not started:
            again = self._repository.get_source_job_row(str(payload["sourceId"]))
            if again and again["status"] == "ready":
                return
            if again and again["status"] == "processing" and again["bullmq_job_id"] == job_id:
                pass
            elif again and again["status"] == "processing":
                return
            else:
                message = f"Could not move source {payload['sourceId']} to processing"
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
                        str(payload["sourceId"]),
                        error_code="processing_transition_failed",
                        error_message=message,
                    )
                    raise UnrecoverableJobError(message)
                raise RetryableJobError(message)

        pdf_bytes = self._storage.get_source_object_buffer(str(row["storage_key"]))
        actual_checksum = hashlib.sha256(pdf_bytes).hexdigest()
        if row.get("checksum") and actual_checksum.lower() != str(row["checksum"]).lower():
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="checksum_mismatch",
                error_message="File checksum does not match the declared checksum",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
            )

        try:
            num_pages, pages = self._pdf_extractor.extract_page_texts(pdf_bytes)
        except Exception as error:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="invalid_pdf",
                error_message=str(error)[:2000],
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                failure_class="user",
            )

        if num_pages > MAX_SOURCE_PAGES:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="page_limit_exceeded",
                error_message=f"PDF exceeds {MAX_SOURCE_PAGES} pages",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                failure_class="user",
            )

        weak_indices = (
            list(range(len(pages)))
            if bool(payload.get("forceOcr"))
            else self._pdf_extractor.page_indices_needing_ocr(pages)
        )
        merged_pages = list(pages)
        if weak_indices:
            try:
                ocr_result = self._ocr_client.run(
                    storage_key=str(row["storage_key"]),
                    pages=weak_indices,
                )
            except Exception as error:
                self._fail_job(
                    payload,
                    job_id=job_id,
                    error_code="mistral_ocr_failed",
                    error_message=str(error)[:2000],
                    retryable=True,
                    attempts_made=attempts_made,
                    max_attempts=max_attempts,
                )
            if ocr_result and ocr_result.get("pages"):
                for page in ocr_result["pages"]:
                    index = int(page["index"])
                    if 0 <= index < len(merged_pages):
                        merged_pages[index] = str(page["markdown"]).strip()
            elif payload.get("forceOcr"):
                self._fail_job(
                    payload,
                    job_id=job_id,
                    error_code="ocr_forced_unavailable",
                    error_message="OCR was requested explicitly but no OCR output was available",
                    retryable=True,
                    attempts_made=attempts_made,
                    max_attempts=max_attempts,
                    failure_class="system",
                )

        text_out = "\n\n".join(
            f"## Page {index + 1}\n\n{page_text}" for index, page_text in enumerate(merged_pages)
        )
        if text_out.strip() and len(text_out.strip()) < 20:
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="empty_extracted_text",
                error_message="No meaningful text could be extracted",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
                failure_class="user",
            )

        parsed_key = self._storage.source_parsed_text_key(
            str(row["workspace_id"]),
            str(row["id"]),
        )
        body = text_out.encode("utf-8")
        self._storage.put_source_object(
            key=parsed_key,
            body=body,
            content_type=PARSED_TEXT_CONTENT_TYPE,
        )
        ready = self._repository.mark_ready(
            str(payload["sourceId"]),
            parsed_text_storage_key=parsed_key,
            page_count=num_pages,
            parsed_text_size_bytes=len(body),
        )
        if not ready.get("ok"):
            self._fail_job(
                payload,
                job_id=job_id,
                error_code="ready_transition_failed",
                error_message="Could not finalize source as ready",
                retryable=False,
                attempts_made=attempts_made,
                max_attempts=max_attempts,
            )
        self._events.log_launch_event(
            "source.parse_ready",
            {
                "sourceId": payload["sourceId"],
                "userId": payload["userId"],
                "documentId": payload["documentId"],
                "pageCount": num_pages,
                "parsedTextSizeBytes": len(body),
            },
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
        failure_class: str = "system",
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
            failure_class=failure_class,
        )
        if strategy["mark_failed"]:
            self._repository.mark_failed(
                str(payload["sourceId"]),
                error_code=error_code,
                error_message=error_message,
            )
            self._events.log_launch_event(
                "source.parse_failed",
                {
                    "sourceId": payload["sourceId"],
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
        failure_class: str = "system",
    ) -> None:
        self._events.log_error_event(
            {
                "domain": "worker",
                "failureClass": failure_class,
                "code": code,
                "jobId": job_id,
                "sourceId": payload["sourceId"],
                "documentId": payload["documentId"],
                "userId": payload["userId"],
                "workspaceId": payload["workspaceId"],
                "message": message,
                "attemptNumber": attempts_made + 1,
                "maxAttempts": max_attempts,
                "terminal": terminal,
                "willRetry": will_retry,
                "workerJob": "parse_source",
            }
        )


__all__ = ["ParseSourceProcessor"]
