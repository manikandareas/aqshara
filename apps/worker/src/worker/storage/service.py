from __future__ import annotations

import boto3
from botocore.client import BaseClient

from worker.config import Settings


class StorageService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._r2_client: BaseClient | None = None

    def create_export_key(self, user_id: str, export_id: str) -> str:
        return "/".join(["exports", user_id, f"{export_id}.docx"])

    def source_original_key(self, workspace_id: str, source_id: str) -> str:
        return "/".join(["sources", workspace_id, source_id, "original.pdf"])

    def source_parsed_text_key(self, workspace_id: str, source_id: str) -> str:
        return "/".join(["sources", workspace_id, source_id, "parsed.txt"])

    def write_export_file(self, key: str, data: bytes) -> None:
        if self._settings.r2_configured:
            self._client().put_object(
                Bucket=self._settings.r2_bucket,
                Key=key,
                Body=data,
                ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            return
        full_path = self._settings.aqshara_exports_dir / key
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)

    def get_source_object_buffer(self, key: str) -> bytes:
        if self._settings.r2_configured:
            response = self._client().get_object(
                Bucket=self._settings.r2_bucket,
                Key=key,
            )
            return response["Body"].read()
        return (self._settings.aqshara_sources_dir / key).read_bytes()

    def put_source_object(self, *, key: str, body: bytes, content_type: str) -> None:
        if self._settings.r2_configured:
            self._client().put_object(
                Bucket=self._settings.r2_bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )
            return
        full_path = self._settings.aqshara_sources_dir / key
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(body)

    def presign_source_get(self, key: str, *, expires_seconds: int = 900) -> str:
        if not self._settings.r2_configured:
            raise ValueError("R2 object storage is not configured")
        return self._client().generate_presigned_url(
            "get_object",
            Params={"Bucket": self._settings.r2_bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )

    def _client(self) -> BaseClient:
        if self._r2_client is None:
            self._r2_client = boto3.client(
                "s3",
                endpoint_url=self._settings.r2_endpoint,
                aws_access_key_id=self._settings.r2_access_key_id,
                aws_secret_access_key=self._settings.r2_secret_access_key,
                region_name="auto",
            )
        return self._r2_client
