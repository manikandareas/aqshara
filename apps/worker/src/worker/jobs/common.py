from __future__ import annotations


class RetryableJobError(Exception):
    pass


class UnrecoverableJobError(Exception):
    pass


def failure_strategy(*, retryable: bool, attempts_made: int, max_attempts: int) -> dict[str, bool]:
    if not retryable:
        return {"mark_failed": True, "unrecoverable": True}
    return {
        "mark_failed": attempts_made + 1 >= max(1, max_attempts),
        "unrecoverable": False,
    }
