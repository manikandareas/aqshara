from __future__ import annotations

from datetime import datetime, timedelta

from worker.db.connection import Database


def reconcile_stuck_jobs(database: Database, *, recovery_stale_ms: int) -> None:
    cutoff = datetime.utcnow() - timedelta(milliseconds=recovery_stale_ms)
    with database.connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            update exports
            set status = 'failed',
                error_code = 'worker_recovered_stale_processing',
                error_message = 'Export was recovered after worker restart',
                updated_at = now()
            where status = 'processing'
              and processing_started_at is not null
              and processing_started_at < %s
            """,
            (cutoff,),
        )
        cur.execute(
            """
            update sources
            set status = 'failed',
                error_code = 'worker_recovered_stale_processing',
                error_message = 'Source was recovered after worker restart',
                updated_at = now()
            where status = 'processing'
              and processing_started_at is not null
              and processing_started_at < %s
              and deleted_at is null
            """,
            (cutoff,),
        )
        conn.commit()
