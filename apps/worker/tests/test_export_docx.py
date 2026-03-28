from __future__ import annotations

from worker.jobs.export_docx import ExportDocxProcessor, UnrecoverableJobError


class _ExportRepository:
    def __init__(self) -> None:
        self.ready_calls: list[dict[str, object]] = []
        self.failed_calls: list[dict[str, object]] = []

    def get_export_job_row(self, export_id: str) -> dict[str, object] | None:
        return {
            "id": export_id,
            "user_id": "user-1",
            "document_id": "doc-1",
            "workspace_id": "ws-1",
            "status": "queued",
            "bullmq_job_id": None,
        }

    def mark_processing(self, export_id: str, bullmq_job_id: str) -> dict[str, object] | None:
        return {"id": export_id}

    def get_document(self, document_id: str) -> dict[str, object] | None:
        return {
            "id": document_id,
            "title": "Doc title",
            "content_json": [
                {
                    "type": "heading",
                    "id": "h1",
                    "level": 1,
                    "children": [{"text": "Title"}],
                },
                {
                    "type": "paragraph",
                    "id": "p1",
                    "children": [{"text": "Body"}],
                },
            ],
        }

    def mark_ready(
        self,
        export_id: str,
        *,
        storage_key: str,
        content_type: str,
        file_size_bytes: int,
    ) -> dict[str, object]:
        payload = {
            "export_id": export_id,
            "storage_key": storage_key,
            "content_type": content_type,
            "file_size_bytes": file_size_bytes,
        }
        self.ready_calls.append(payload)
        return {"ok": True}

    def mark_failed(self, export_id: str, *, error_code: str, error_message: str) -> dict[str, object]:
        self.failed_calls.append(
            {
                "export_id": export_id,
                "error_code": error_code,
                "error_message": error_message,
            }
        )
        return {"ok": True}


class _Storage:
    def __init__(self) -> None:
        self.writes: list[tuple[str, bytes]] = []

    def create_export_key(self, user_id: str, export_id: str) -> str:
        return f"exports/{user_id}/{export_id}.docx"

    def write_export_file(self, key: str, data: bytes) -> None:
        self.writes.append((key, data))


class _Events:
    def __init__(self) -> None:
        self.launch_events: list[str] = []
        self.error_events: list[dict[str, object]] = []

    def log_launch_event(self, event: str, fields: dict[str, object]) -> None:
        self.launch_events.append(event)

    def log_error_event(self, payload: dict[str, object]) -> None:
        self.error_events.append(payload)


def test_export_docx_processor_writes_docx_and_marks_ready() -> None:
    repository = _ExportRepository()
    storage = _Storage()
    events = _Events()
    processor = ExportDocxProcessor(repository, storage, events)

    processor.process(
        {
            "exportId": "exp-1",
            "documentId": "doc-1",
            "userId": "user-1",
            "workspaceId": "ws-1",
            "idempotencyKey": "idem-1",
        },
        job_id="job-1",
        attempts_made=0,
        max_attempts=3,
    )

    assert storage.writes
    assert storage.writes[0][0] == "exports/user-1/exp-1.docx"
    assert storage.writes[0][1][:2] == b"PK"
    assert repository.ready_calls == [
        {
            "export_id": "exp-1",
            "storage_key": "exports/user-1/exp-1.docx",
            "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "file_size_bytes": len(storage.writes[0][1]),
        }
    ]
    assert events.launch_events == ["export.docx_ready"]


def test_export_docx_processor_rejects_payload_mismatch() -> None:
    repository = _ExportRepository()
    events = _Events()
    processor = ExportDocxProcessor(repository, _Storage(), events)

    try:
        processor.process(
            {
                "exportId": "exp-1",
                "documentId": "doc-1",
                "userId": "user-2",
                "workspaceId": "ws-1",
                "idempotencyKey": "idem-1",
            },
            job_id="job-1",
            attempts_made=0,
            max_attempts=3,
        )
    except UnrecoverableJobError as error:
        assert "payload does not match export record" in str(error)
    else:
        raise AssertionError("expected payload mismatch to be unrecoverable")
    assert events.error_events[0]["code"] == "payload_mismatch"
    assert repository.failed_calls == [
        {
            "export_id": "exp-1",
            "error_code": "payload_mismatch",
            "error_message": "Job payload does not match export record",
        }
    ]
