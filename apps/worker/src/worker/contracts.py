from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ExportDocxPayload(BaseModel):
    export_id: str = Field(alias="exportId", min_length=1)
    document_id: str = Field(alias="documentId", min_length=1)
    user_id: str = Field(alias="userId", min_length=1)
    workspace_id: str = Field(alias="workspaceId", min_length=1)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class ParseSourcePayload(BaseModel):
    source_id: str = Field(alias="sourceId", min_length=1)
    document_id: str = Field(alias="documentId", min_length=1)
    user_id: str = Field(alias="userId", min_length=1)
    workspace_id: str = Field(alias="workspaceId", min_length=1)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)
    force_ocr: bool = Field(default=False, alias="forceOcr")

    model_config = ConfigDict(populate_by_name=True)


class JobOptions(BaseModel):
    attempts: int = 1


class ExportDocxJob(BaseModel):
    id: str
    name: Literal["export_docx"]
    data: ExportDocxPayload
    attempts_made: int = Field(default=0, alias="attemptsMade")
    opts: JobOptions = Field(default_factory=JobOptions)

    model_config = ConfigDict(populate_by_name=True)


class ParseSourceJob(BaseModel):
    id: str
    name: Literal["parse_source"]
    data: ParseSourcePayload
    attempts_made: int = Field(default=0, alias="attemptsMade")
    opts: JobOptions = Field(default_factory=JobOptions)

    model_config = ConfigDict(populate_by_name=True)


class ExportDocxJobRequest(BaseModel):
    job: ExportDocxJob


class ParseSourceJobRequest(BaseModel):
    job: ParseSourceJob


class HealthResponse(BaseModel):
    ok: bool
    service: str
    timestamp: str
    dependencies: dict[str, bool] | None = None
