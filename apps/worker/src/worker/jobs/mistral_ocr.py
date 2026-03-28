from __future__ import annotations

from typing import Any

import requests

from worker.config import Settings
from worker.storage import StorageService


class MistralOcrClient:
    def __init__(self, settings: Settings, storage: StorageService) -> None:
        self._settings = settings
        self._storage = storage

    def run(self, *, storage_key: str, pages: list[int] | None = None) -> dict[str, Any] | None:
        if not self._settings.mistral_enabled:
            return None
        document_url = self._storage.presign_source_get(storage_key)
        body: dict[str, Any] = {
            "model": "mistral-ocr-latest",
            "document": {
                "type": "document_url",
                "document_url": document_url,
            },
        }
        if pages:
            body["pages"] = pages
        response = requests.post(
            f"{str(self._settings.mistral_api_base_url).rstrip('/')}/v1/ocr",
            headers={
                "Authorization": f"Bearer {self._settings.mistral_api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=self._settings.mistral_ocr_timeout_ms / 1000,
        )
        if not response.ok:
            raise RuntimeError(
                f"Mistral OCR failed: {response.status_code} {response.text[:500]}"
            )
        payload = response.json()
        pages_out = [
            {"index": page["index"], "markdown": page["markdown"]}
            for page in payload.get("pages", [])
            if isinstance(page.get("index"), int) and isinstance(page.get("markdown"), str) and page["markdown"]
        ]
        return {"pages": pages_out, "text": "\n\n".join(page["markdown"] for page in pages_out)}
