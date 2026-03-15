import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly bucketName: string;
  private readonly endpoint: string;
  private readonly publicBaseUrl: string | null;
  private readonly readinessCheckStorage: boolean;
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET');
    this.endpoint = this.configService.getOrThrow<string>('R2_ENDPOINT');
    this.publicBaseUrl =
      this.configService.get<string>('R2_PUBLIC_BASE_URL')?.trim() || null;
    this.readinessCheckStorage = this.configService.get<boolean>(
      'READINESS_CHECK_STORAGE',
      false,
    );

    this.s3Client = new S3Client({
      region: this.configService.getOrThrow<string>('R2_REGION'),
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  createDocumentSourceKey(documentId: string, filename: string): string {
    return `documents/${documentId}/source/${filename}`;
  }

  createDocumentOcrArtifactKey(documentId: string): string {
    return `documents/${documentId}/artifacts/ocr/raw.json`;
  }

  createDocumentAssetKey(
    documentId: string,
    paragraphId: string,
    shortHash: string,
    extension: string,
  ): string {
    const normalizedExt = extension.replace(/^\.+/g, '').toLowerCase() || 'bin';
    return `documents/${documentId}/assets/${paragraphId}_${shortHash}.${normalizedExt}`;
  }

  createVideoFinalKey(videoJobId: string): string {
    return `videos/${videoJobId}/final.mp4`;
  }

  createVideoArtifactKey(videoJobId: string, filename: string): string {
    return `videos/${videoJobId}/artifacts/${filename}`;
  }

  createObjectUrl(key: string): string {
    const normalizedEndpoint = (
      this.publicBaseUrl
        ? this.publicBaseUrl
        : `${this.endpoint.replace(/\/+$/g, '')}/${this.bucketName}`
    ).replace(/\/+$/g, '');
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `${normalizedEndpoint}/${encodedKey}`;
  }

  async uploadObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string) {
    return this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (error) {
      const code = (
        error as { name?: string; $metadata?: { httpStatusCode?: number } }
      ).name;
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;

      if (code === 'NoSuchKey' || statusCode === 404) {
        return;
      }

      throw error;
    }
  }

  async isReady(): Promise<{ ready: boolean }> {
    if (!this.readinessCheckStorage) {
      return { ready: true };
    }

    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        }),
      );
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }
}
