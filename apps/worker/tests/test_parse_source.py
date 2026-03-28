from __future__ import annotations

from worker.jobs.parse_source import ParseSourceProcessor


class _ParseRepository:
    def __init__(self) -> None:
        self.ready_calls: list[dict[str, object]] = []

    def get_source_job_row(self, source_id: str) -> dict[str, object] | None:
        return {
            "id": source_id,
            "user_id": "user-1",
            "workspace_id": "ws-1",
            "storage_key": "sources/ws-1/source-1/original.pdf",
            "checksum": "20227f8fb4a723e14deaf49b4b1f20b20f19d91ecdfbc973bc4e838624a2a8a6",
            "status": "queued",
            "bullmq_job_id": None,
        }

    def get_document_row(self, document_id: str) -> dict[str, object] | None:
        return {"id": document_id, "workspace_id": "ws-1"}

    def get_document_source_link_row(self, source_id: str, document_id: str) -> dict[str, object] | None:
        return {"id": "link-1"}

    def mark_processing(self, source_id: str, bullmq_job_id: str) -> dict[str, object] | None:
        return {"id": source_id}

    def mark_ready(
        self,
        source_id: str,
        *,
        parsed_text_storage_key: str,
        page_count: int,
        parsed_text_size_bytes: int,
    ) -> dict[str, object]:
        payload = {
            "source_id": source_id,
            "parsed_text_storage_key": parsed_text_storage_key,
            "page_count": page_count,
            "parsed_text_size_bytes": parsed_text_size_bytes,
        }
        self.ready_calls.append(payload)
        return {"ok": True}

    def mark_failed(self, source_id: str, *, error_code: str, error_message: str) -> dict[str, object]:
        raise AssertionError("mark_failed should not be called")


class _SourceStorage:
    def __init__(self) -> None:
        self.put_calls: list[tuple[str, str, bytes]] = []

    def get_source_object_buffer(self, key: str) -> bytes:
        return b"%PDF-mock"

    def put_source_object(self, *, key: str, body: bytes, content_type: str) -> None:
        self.put_calls.append((key, content_type, body))

    def source_parsed_text_key(self, workspace_id: str, source_id: str) -> str:
        return f"sources/{workspace_id}/{source_id}/parsed.txt"


class _PdfExtractor:
    def extract_page_texts(self, pdf_bytes: bytes) -> tuple[int, list[str]]:
        assert pdf_bytes == b"%PDF-mock"
        return 1, ["Hello from the embedded PDF text, enough to skip OCR."]

    def page_indices_needing_ocr(self, pages: list[str]) -> list[int]:
        return []


class _Ocr:
    def run(self, *, storage_key: str, pages: list[int] | None = None) -> dict[str, object] | None:
        raise AssertionError("OCR should not be called")


class _Events:
    def __init__(self) -> None:
        self.launch_events: list[str] = []

    def log_launch_event(self, event: str, fields: dict[str, object]) -> None:
        self.launch_events.append(event)

    def log_error_event(self, payload: dict[str, object]) -> None:
        raise AssertionError(f"unexpected error event: {payload}")


def test_parse_source_processor_stores_text_and_marks_ready() -> None:
    repository = _ParseRepository()
    storage = _SourceStorage()
    processor = ParseSourceProcessor(
        repository=repository,
        storage=storage,
        pdf_extractor=_PdfExtractor(),
        ocr_client=_Ocr(),
        events=_Events(),
    )

    processor.process(
        {
            "sourceId": "source-1",
            "documentId": "document-1",
            "userId": "user-1",
            "workspaceId": "ws-1",
            "idempotencyKey": "idem-1",
            "forceOcr": False,
        },
        job_id="job-1",
        attempts_made=0,
        max_attempts=3,
    )

    assert storage.put_calls == [
        (
            "sources/ws-1/source-1/parsed.txt",
            "text/plain; charset=utf-8",
            b"## Page 1\n\nHello from the embedded PDF text, enough to skip OCR.",
        )
    ]
    assert repository.ready_calls == [
        {
            "source_id": "source-1",
            "parsed_text_storage_key": "sources/ws-1/source-1/parsed.txt",
            "page_count": 1,
            "parsed_text_size_bytes": len(
                "## Page 1\n\nHello from the embedded PDF text, enough to skip OCR."
            ),
        }
    ]
