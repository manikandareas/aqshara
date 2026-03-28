from __future__ import annotations

from datetime import datetime
from typing import Any

from .connection import Database


class SourceRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    def get_source_job_row(self, source_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select * from sources
                where id = %s and deleted_at is null
                limit 1
                """,
                (source_id,),
            )
            return cur.fetchone()

    def get_document_row(self, document_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute("select * from documents where id = %s limit 1", (document_id,))
            return cur.fetchone()

    def get_document_source_link_row(self, source_id: str, document_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select * from document_source_links
                where source_id = %s and document_id = %s
                limit 1
                """,
                (source_id, document_id),
            )
            return cur.fetchone()

    def mark_processing(self, source_id: str, bullmq_job_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                update sources
                set status = 'processing',
                    bullmq_job_id = %s,
                    processing_started_at = now(),
                    updated_at = now()
                where id = %s and status = 'queued' and deleted_at is null
                returning *
                """,
                (bullmq_job_id, source_id),
            )
            row = cur.fetchone()
            conn.commit()
            return row

    def mark_ready(
        self,
        source_id: str,
        *,
        parsed_text_storage_key: str,
        page_count: int,
        parsed_text_size_bytes: int,
    ) -> dict[str, Any]:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select * from sources
                where id = %s and deleted_at is null
                limit 1
                """,
                (source_id,),
            )
            current = cur.fetchone()
            if not current or current["status"] != "processing":
                return {"ok": False, "reason": "invalid_state"}

            now = datetime.utcnow()
            cur.execute(
                """
                update sources
                set status = 'ready',
                    parsed_text_storage_key = %s,
                    parsed_text_size_bytes = %s,
                    page_count = %s,
                    ready_at = %s,
                    updated_at = %s,
                    error_message = null,
                    error_code = null
                where id = %s
                """,
                (
                    parsed_text_storage_key,
                    parsed_text_size_bytes,
                    page_count,
                    now,
                    now,
                    source_id,
                ),
            )

            cur.execute(
                """
                select * from monthly_usage_counters
                where user_id = %s and period = %s
                limit 1
                """,
                (current["user_id"], current["billing_period"]),
            )
            counters = cur.fetchone()
            if counters:
                cur.execute(
                    """
                    update monthly_usage_counters
                    set source_uploads_used = %s,
                        storage_used_bytes = %s,
                        updated_at = %s
                    where id = %s
                    """,
                    (
                        counters["source_uploads_used"] + 1,
                        counters["storage_used_bytes"] + parsed_text_size_bytes,
                        now,
                        counters["id"],
                    ),
                )
            else:
                cur.execute(
                    """
                    insert into monthly_usage_counters
                        (user_id, period, source_uploads_used, storage_used_bytes)
                    values (%s, %s, 1, %s)
                    """,
                    (
                        current["user_id"],
                        current["billing_period"],
                        parsed_text_size_bytes,
                    ),
                )
            conn.commit()
            return {"ok": True}

    def mark_failed(
        self,
        source_id: str,
        *,
        error_code: str,
        error_message: str,
    ) -> dict[str, Any]:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                update sources
                set status = 'failed',
                    error_message = %s,
                    error_code = %s,
                    updated_at = now()
                where id = %s and status in ('processing', 'queued') and deleted_at is null
                returning id
                """,
                (error_message, error_code, source_id),
            )
            updated = cur.fetchone()
            conn.commit()
            return {"ok": bool(updated)}
