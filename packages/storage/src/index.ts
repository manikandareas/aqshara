import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Config, getR2Endpoint, type R2Config } from "@aqshara/config";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type StorageObject = {
  key: string;
  contentType: string;
  size: number;
};

export function createStorageKey(...segments: string[]) {
  return segments.join("/");
}

/** Root directory for persisted export files (DOCX). Override with AQSHARA_EXPORTS_DIR. */
export function getExportsRootDir(): string {
  return (
    process.env.AQSHARA_EXPORTS_DIR ?? join(process.cwd(), ".data", "exports")
  );
}

/** Root for source originals and artifacts when R2 is not configured (local dev / tests). */
export function getSourcesRootDir(): string {
  return (
    process.env.AQSHARA_SOURCES_DIR ?? join(process.cwd(), ".data", "sources")
  );
}

/** Write binary object under the exports root. `key` is relative (e.g. userId/exportId.docx). */
export async function writeExportFile(
  key: string,
  data: Buffer,
): Promise<void> {
  const config = getR2Config();
  if (config) {
    const client = getR2S3Client(config);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: data,
        ContentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    return;
  }

  const fullPath = join(getExportsRootDir(), key);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
}

export async function readExportFile(key: string): Promise<Buffer> {
  const config = getR2Config();
  if (config) {
    const client = getR2S3Client(config);
    const out = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) {
      return Buffer.alloc(0);
    }
    return Buffer.from(bytes);
  }

  const fullPath = join(getExportsRootDir(), key);
  return readFile(fullPath);
}

export async function presignGetExportObject(input: {
  key: string;
  expiresSeconds?: number;
  filename?: string;
}): Promise<string> {
  const config = getR2Config();
  if (!config) {
    throw new Error("R2 object storage is not configured");
  }
  const client = getR2S3Client(config);
  const cmd = new GetObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    ResponseContentDisposition: input.filename
      ? `attachment; filename="${input.filename}"`
      : undefined,
  });
  return getSignedUrl(client, cmd, {
    expiresIn: input.expiresSeconds ?? 900,
  });
}

let r2Client: S3Client | undefined;

function getR2S3Client(config: R2Config): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: getR2Endpoint(config.accountId),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return r2Client;
}

export function isR2ObjectStorageConfigured(): boolean {
  return getR2Config() !== null;
}

export function getActiveR2Config(): R2Config | null {
  return getR2Config();
}

export async function presignPutSourceObject(input: {
  key: string;
  contentType: string;
  expiresSeconds?: number;
}): Promise<{ url: string; bucket: string }> {
  const config = getR2Config();
  if (!config) {
    throw new Error("R2 object storage is not configured");
  }
  const client = getR2S3Client(config);
  const cmd = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
  const url = await getSignedUrl(client, cmd, {
    expiresIn: input.expiresSeconds ?? 900,
  });
  return { url, bucket: config.bucket };
}

export async function presignGetSourceObject(input: {
  key: string;
  expiresSeconds?: number;
}): Promise<string> {
  const config = getR2Config();
  if (!config) {
    throw new Error("R2 object storage is not configured");
  }
  const client = getR2S3Client(config);
  const cmd = new GetObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
  });
  return getSignedUrl(client, cmd, {
    expiresIn: input.expiresSeconds ?? 900,
  });
}

export async function headSourceObject(
  key: string,
): Promise<StorageObject | null> {
  const config = getR2Config();
  if (config) {
    const client = getR2S3Client(config);
    try {
      const out = await client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      const size = Number(out.ContentLength ?? 0);
      const contentType = out.ContentType ?? "application/octet-stream";
      return { key, contentType, size };
    } catch (e: unknown) {
      const name =
        e && typeof e === "object" && "name" in e
          ? String((e as { name: string }).name)
          : "";
      if (name === "NotFound" || name === "NoSuchKey") {
        return null;
      }
      throw e;
    }
  }

  const fullPath = join(getSourcesRootDir(), key);
  try {
    const st = await stat(fullPath);
    return {
      key,
      contentType: "application/pdf",
      size: st.size,
    };
  } catch {
    return null;
  }
}

export async function getSourceObjectBuffer(key: string): Promise<Buffer> {
  const config = getR2Config();
  if (config) {
    const client = getR2S3Client(config);
    const out = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) {
      return Buffer.alloc(0);
    }
    return Buffer.from(bytes);
  }

  const fullPath = join(getSourcesRootDir(), key);
  return readFile(fullPath);
}

export async function putSourceObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const config = getR2Config();
  if (config) {
    const client = getR2S3Client(config);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return;
  }

  const fullPath = join(getSourcesRootDir(), input.key);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, input.body);
}

export async function deleteSourceObject(key: string): Promise<void> {
  const config = getR2Config();
  if (config) {
    const client = getR2S3Client(config);
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    return;
  }

  const fullPath = join(getSourcesRootDir(), key);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing
  }
}

/** Namespace helpers for consistent keys. */
export function sourceOriginalKey(workspaceId: string, sourceId: string) {
  return createStorageKey("sources", workspaceId, sourceId, "original.pdf");
}

export function sourceParsedTextKey(workspaceId: string, sourceId: string) {
  return createStorageKey("sources", workspaceId, sourceId, "parsed.txt");
}
