import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { VideoWorkerBridgeService } from '../video-worker-bridge.service';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

type MockChildProcess = EventEmitter & {
  kill: jest.Mock;
  stdin: {
    write: jest.Mock;
    end: jest.Mock;
  };
  stdout: EventEmitter;
  stderr: EventEmitter;
};

function createMockChildProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.kill = jest.fn();
  child.stdin = {
    write: jest.fn(),
    end: jest.fn(),
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe('VideoWorkerBridgeService', () => {
  const spawnMock = jest.mocked(spawn);

  const configService = {
    get<T>(key: string, defaultValue?: T): T {
      const values: Record<string, unknown> = {
        VIDEO_WORKER_COMMAND: 'uv',
        VIDEO_WORKER_PROJECT_DIR: '../aqshara-video-worker',
        VIDEO_WORKER_ENTRY_MODULE: 'aqshara_video_worker.run_job',
        VIDEO_WORKER_CALLBACK_BASE_URL: 'http://127.0.0.1:8000/api/v1',
        VIDEO_INTERNAL_SERVICE_TOKEN: 'local-video-internal-token',
      };

      return (values[key] ?? defaultValue) as T;
    },
  } as ConfigService;

  const service = new VideoWorkerBridgeService(configService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('spawns the uv-managed Python worker and writes the job payload to stdin', async () => {
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child as never);

    const promise = service.run({
      video_job_id: 'vjob_1',
      document_id: 'doc_1',
      actor_id: 'user_1',
      target_duration_sec: 60,
      voice: 'alloy',
      language: 'en',
      request_id: 'req_1',
      attempt: 1,
    });

    child.emit('close', 0);
    await promise;

    expect(spawnMock).toHaveBeenCalledWith(
      'uv',
      [
        'run',
        '--project',
        expect.stringContaining('aqshara-video-worker'),
        'python',
        '-m',
        'aqshara_video_worker.run_job',
      ],
      expect.objectContaining({
        cwd: expect.stringContaining('aqshara-video-worker'),
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
    expect(child.stdin.write).toHaveBeenCalledWith(
      JSON.stringify({
        video_job_id: 'vjob_1',
        document_id: 'doc_1',
        actor_id: 'user_1',
        target_duration_sec: 60,
        voice: 'alloy',
        language: 'en',
        request_id: 'req_1',
        attempt: 1,
      }),
    );
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('rejects when the worker exits with a non-zero code', async () => {
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child as never);

    const promise = service.run({
      video_job_id: 'vjob_1',
      document_id: 'doc_1',
      actor_id: 'user_1',
      target_duration_sec: 60,
      voice: 'alloy',
      language: 'en',
      request_id: null,
      attempt: 1,
    });

    child.stderr.emit('data', Buffer.from('worker failed'));
    child.emit('close', 1);

    await expect(promise).rejects.toThrow('worker failed');
  });

  it('rejects with a timeout error when the worker does not finish in time', async () => {
    jest.useFakeTimers();

    const timeoutConfigService = {
      get<T>(key: string, defaultValue?: T): T {
        const values: Record<string, unknown> = {
          VIDEO_WORKER_COMMAND: 'uv',
          VIDEO_WORKER_PROJECT_DIR: '../aqshara-video-worker',
          VIDEO_WORKER_ENTRY_MODULE: 'aqshara_video_worker.run_job',
          VIDEO_WORKER_CALLBACK_BASE_URL: 'http://127.0.0.1:8000/api/v1',
          VIDEO_INTERNAL_SERVICE_TOKEN: 'local-video-internal-token',
          VIDEO_WORKER_TIMEOUT_MS: 10,
        };

        return (values[key] ?? defaultValue) as T;
      },
    } as ConfigService;
    const timeoutService = new VideoWorkerBridgeService(timeoutConfigService);
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child as never);

    const promise = timeoutService.run({
      video_job_id: 'vjob_timeout',
      document_id: 'doc_timeout',
      actor_id: 'user_timeout',
      target_duration_sec: 60,
      voice: 'alloy',
      language: 'en',
      request_id: null,
      attempt: 1,
    });

    jest.advanceTimersByTime(10);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    child.emit('close', null, 'SIGTERM');

    await expect(promise).rejects.toThrow('Video worker timed out after 10ms');
    jest.useRealTimers();
  });
});
