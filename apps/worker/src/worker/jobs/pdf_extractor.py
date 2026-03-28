from __future__ import annotations

import fitz


class PdfExtractor:
    min_chars_weak_page = 48

    def extract_page_texts(self, pdf_bytes: bytes) -> tuple[int, list[str]]:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages: list[str] = []
        for page in document:
            pages.append(" ".join(page.get_text("text").split()).strip())
        return document.page_count, pages

    def page_indices_needing_ocr(self, pages: list[str]) -> list[int]:
        return [
            index for index, page in enumerate(pages) if len(page) < self.min_chars_weak_page
        ]
