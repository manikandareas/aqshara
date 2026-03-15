import { Buffer } from 'node:buffer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BunnyCreateVideoResponse = {
  guid?: string;
  Guid?: string;
  status?: number;
  Status?: number;
};

type BunnyGetVideoResponse = {
  guid?: string;
  Guid?: string;
  status?: number;
  Status?: number;
};

export type BunnyStreamVideoState = {
  libraryId: string;
  videoId: string;
  status: number | null;
};

@Injectable()
export class BunnyStreamService {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly libraryId: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiBaseUrl = this.configService
      .get<string>('BUNNY_STREAM_API_BASE_URL', 'https://video.bunnycdn.com')
      .replace(/\/+$/g, '');
    this.apiKey = this.configService.get<string>('BUNNY_STREAM_API_KEY', '');
    this.libraryId = this.configService.get<string>(
      'BUNNY_STREAM_LIBRARY_ID',
      '',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUNNY_STREAM_TIMEOUT_MS',
      30_000,
    );
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0 && this.libraryId.length > 0;
  }

  getLibraryId(): string {
    return this.libraryId;
  }

  buildEmbedUrl(videoId: string, libraryId = this.libraryId): string {
    return `https://player.mediadelivery.net/embed/${libraryId}/${videoId}`;
  }

  async createVideo(title: string): Promise<BunnyStreamVideoState> {
    const response = await this.request<BunnyCreateVideoResponse>(
      `/library/${this.libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title }),
      },
    );

    const videoId = response.guid ?? response.Guid;

    if (!videoId) {
      throw new Error('Bunny Stream create video response missing guid');
    }

    return {
      libraryId: this.libraryId,
      videoId,
      status: response.status ?? response.Status ?? null,
    };
  }

  async uploadVideo(
    videoId: string,
    bytes: Uint8Array,
    _contentType?: string | null,
  ): Promise<void> {
    await this.request(`/library/${this.libraryId}/videos/${videoId}`, {
      method: 'PUT',
      headers: {
        accept: 'application/json',
      },
      body: Buffer.from(bytes),
    });
  }

  async getVideo(videoId: string): Promise<BunnyStreamVideoState> {
    const response = await this.request<BunnyGetVideoResponse>(
      `/library/${this.libraryId}/videos/${videoId}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
    );

    return {
      libraryId: this.libraryId,
      videoId: response.guid ?? response.Guid ?? videoId,
      status: response.status ?? response.Status ?? null,
    };
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Bunny Stream is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          AccessKey: this.apiKey,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bunny Stream request failed (${response.status}): ${errorText || response.statusText}`,
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }

      return undefined as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
