import { ConfigService } from '@nestjs/config';
import { BunnyStreamService } from './bunny-stream.service';

describe('BunnyStreamService', () => {
  const configService = {
    get: jest.fn((key: string, fallback?: string | number) => {
      if (key === 'BUNNY_STREAM_API_BASE_URL') {
        return 'https://video.bunnycdn.com';
      }
      if (key === 'BUNNY_STREAM_API_KEY') {
        return 'test-access-key';
      }
      if (key === 'BUNNY_STREAM_LIBRARY_ID') {
        return '12345';
      }
      if (key === 'BUNNY_STREAM_TIMEOUT_MS') {
        return 30_000;
      }
      return fallback;
    }),
  } as unknown as ConfigService;

  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates Bunny videos with explicit JSON headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ guid: 'video-guid', status: 0 }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const service = new BunnyStreamService(configService);

    await expect(service.createVideo('My Video')).resolves.toEqual({
      libraryId: '12345',
      videoId: 'video-guid',
      status: 0,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://video.bunnycdn.com/library/12345/videos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          AccessKey: 'test-access-key',
          accept: 'application/json',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({ title: 'My Video' }),
      }),
    );
  });

  it('uploads raw binary bytes using Bunny supported request shape', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const service = new BunnyStreamService(configService);

    await service.uploadVideo(
      'video-guid',
      new Uint8Array([1, 2, 3]),
      'video/mp4',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://video.bunnycdn.com/library/12345/videos/video-guid',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          AccessKey: 'test-access-key',
          accept: 'application/json',
        }),
        body: expect.any(Buffer),
      }),
    );
  });

  it('does not send content type on raw binary upload', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const service = new BunnyStreamService(configService);

    await service.uploadVideo(
      'video-guid',
      new Uint8Array([1, 2, 3]),
      'application/octet-stream',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://video.bunnycdn.com/library/12345/videos/video-guid',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          AccessKey: 'test-access-key',
          accept: 'application/json',
        }),
        headers: expect.not.objectContaining({
          'Content-Type': expect.any(String),
          'content-type': expect.any(String),
        }),
        body: expect.any(Buffer),
      }),
    );
  });
});
