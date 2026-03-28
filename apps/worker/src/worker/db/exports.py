from __future__ import annotations

from datetime import datetime
from typing import Any

from .connection import Database


class ExportRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    def get_export_job_row(self, export_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute("select * from exports where id = %s limit 1", (export_id,))
            return cur.fetchone()

    def mark_processing(self, export_id: str, bullmq_job_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                update exports
                set status = 'processing',
                    bullmq_job_id = %s,
                    processing_started_at = now(),
                    updated_at = now()
                where id = %s and status = 'queued'
                returning *
                """,
                (bullmq_job_id, export_id),
            )
            row = cur.fetchone()
            conn.commit()
            return row

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute("select * from documents where id = %s limit 1", (document_id,))
            return cur.fetchone()

    def mark_ready(
        self,
        export_id: str,
        *,
        storage_key: str,
        content_type: str,
        file_size_bytes: int,
    ) -> dict[str, Any]:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute("select * from exports where id = %s limit 1", (export_id,))
            current = cur.fetchone()
            if not current or current["status"] != "processing":
                return {"ok": False, "reason": "invalid_state"}

            now = datetime.utcnow()
            cur.execute(
                """
                update exports
                set status = 'ready',
                    storage_key = %s,
                    content_type = %s,
                    file_size_bytes = %s,
                    ready_at = %s,
                    updated_at = %s,
                    error_message = null,
                    error_code = null
                where id = %s
                """,
                (storage_key, content_type, file_size_bytes, now, now, export_id),
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
                    set exports_used = %s, updated_at = %s
                    where id = %s
                    """,
                    (counters["exports_used"] + 1, now, counters["id"]),
                )
            else:
                cur.execute(
                    """
                    insert into monthly_usage_counters (user_id, period, exports_used)
                    values (%s, %s, 1)
                    """,
                    (current["user_id"], current["billing_period"]),
                )
            conn.commit()
            return {"ok": True}

    def mark_failed(
        self,
        export_id: str,
        *,
        error_code: str,
        error_message: str,
    ) -> dict[str, Any]:
        with self._database.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                update exports
                set status = 'failed',
                    error_message = %s,
                    error_code = %s,
                    updated_at = now()
                where id = %s and status in ('processing', 'queued')
                returning id
                """,
                (error_message, error_code, export_id),
            )
            updated = cur.fetchone()
            conn.commit()
            return {"ok": bool(updated)}
