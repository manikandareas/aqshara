from __future__ import annotations

from worker.config import Settings
from worker.db.connection import Database
from worker.db.exports import ExportRepository
from worker.db.sources import SourceRepository
from worker.jobs.export_docx import ExportDocxProcessor
from worker.jobs.mistral_ocr import MistralOcrClient
from worker.jobs.parse_source import ParseSourceProcessor
from worker.jobs.pdf_extractor import PdfExtractor
from worker.logging import create_logger, log_error_event, log_launch_event
from worker.storage import StorageService


class EventSink:
    def log_launch_event(self, event: str, fields: dict[str, object]) -> None:
        log_launch_event(event, fields)

    def log_error_event(self, fields: dict[str, object]) -> None:
        log_error_event(fields)


def build_runtime(settings: Settings) -> tuple[ExportDocxProcessor, ParseSourceProcessor]:
    database = Database(settings.database_url)
    storage = StorageService(settings)
    events = EventSink()
    export_processor = ExportDocxProcessor(
        ExportRepository(database),
        storage,
        events,
    )
    parse_processor = ParseSourceProcessor(
        repository=SourceRepository(database),
        storage=storage,
        pdf_extractor=PdfExtractor(),
        ocr_client=MistralOcrClient(settings, storage),
        events=events,
    )
    return export_processor, parse_processor


__all__ = ["build_runtime", "create_logger"]
