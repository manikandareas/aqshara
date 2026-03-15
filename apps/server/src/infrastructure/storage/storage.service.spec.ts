import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  it('builds public object URLs from R2_PUBLIC_BASE_URL when configured', () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'R2_BUCKET':
            return 'aqshara-dev';
          case 'R2_ENDPOINT':
            return 'https://example.r2.cloudflarestorage.com';
          case 'R2_REGION':
            return 'auto';
          case 'R2_ACCESS_KEY_ID':
            return 'key';
          case 'R2_SECRET_ACCESS_KEY':
            return 'secret';
          default:
            throw new Error(`Unexpected getOrThrow key: ${key}`);
        }
      }),
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'R2_PUBLIC_BASE_URL') {
          return 'https://pub-12345.r2.dev';
        }
        if (key === 'READINESS_CHECK_STORAGE') {
          return false;
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;

    const service = new StorageService(configService);

    expect(
      service.createObjectUrl(
        'documents/doc-1/assets/doc-1_p_1_hash.jpg',
      ),
    ).toBe(
      'https://pub-12345.r2.dev/documents/doc-1/assets/doc-1_p_1_hash.jpg',
    );
  });

  it('falls back to endpoint plus bucket when no public base URL is configured', () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'R2_BUCKET':
            return 'aqshara-dev';
          case 'R2_ENDPOINT':
            return 'https://example.r2.cloudflarestorage.com';
          case 'R2_REGION':
            return 'auto';
          case 'R2_ACCESS_KEY_ID':
            return 'key';
          case 'R2_SECRET_ACCESS_KEY':
            return 'secret';
          default:
            throw new Error(`Unexpected getOrThrow key: ${key}`);
        }
      }),
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'R2_PUBLIC_BASE_URL') {
          return '';
        }
        if (key === 'READINESS_CHECK_STORAGE') {
          return false;
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;

    const service = new StorageService(configService);

    expect(
      service.createObjectUrl(
        'documents/doc-1/assets/doc-1_p_1_hash.jpg',
      ),
    ).toBe(
      'https://example.r2.cloudflarestorage.com/aqshara-dev/documents/doc-1/assets/doc-1_p_1_hash.jpg',
    );
  });
});
