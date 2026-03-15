import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VideoWorkerDispatchPayload } from './video-job.schemas';

@Injectable()
export class VideoWorkerBridgeService {
  private readonly logger = new Logger(VideoWorkerBridgeService.name);

  constructor(private readonly configService: ConfigService) {}

  async run(job: VideoWorkerDispatchPayload): Promise<void> {
    const command = this.getConfig('VIDEO_WORKER_COMMAND', 'uv');
    const projectDir = resolve(
      process.cwd(),
      this.getConfig('VIDEO_WORKER_PROJECT_DIR', '../aqshara-video-worker'),
    );
    const entryModule = this.getConfig(
      'VIDEO_WORKER_ENTRY_MODULE',
      'aqshara_video_worker.run_job',
    );
    const timeoutMs = this.getConfig('VIDEO_WORKER_TIMEOUT_MS', 300000);
    const env = this.buildWorkerEnv();

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        command,
        ['run', '--project', projectDir, 'python', '-m', entryModule],
        {
          cwd: projectDir,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      let stdout = '';
      let stderr = '';
      let didTimeout = false;

      const timeout = setTimeout(() => {
        didTimeout = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on('close', (code, signal) => {
        clearTimeout(timeout);

        if (stdout.trim().length > 0) {
          this.logger.log({
            message: 'Video worker stdout',
            video_job_id: job.video_job_id,
            output: stdout.trim(),
          });
        }

        if (code === 0 && !didTimeout) {
          resolve();
          return;
        }

        const errorMessage = stderr.trim() || stdout.trim();
        const failureDetail = didTimeout
          ? `timed out after ${timeoutMs}ms`
          : this.buildExitDetail(code, signal);

        this.logger.error({
          message: 'Video worker exited with a non-zero status',
          video_job_id: job.video_job_id,
          exit_code: code,
          signal: signal ?? null,
          timed_out: didTimeout,
          stderr: errorMessage || null,
        });

        reject(new Error(errorMessage || `Video worker ${failureDetail}`));
      });

      child.stdin.write(JSON.stringify(job));
      child.stdin.end();
    });
  }

  private getConfig<T>(key: string, fallback: T): T {
    return this.configService.get<T>(key, fallback);
  }

  private buildWorkerEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      VIDEO_WORKER_CALLBACK_BASE_URL:
        this.configService.get<string>('VIDEO_WORKER_CALLBACK_BASE_URL') ??
        'http://127.0.0.1:8000/api/v1',
      VIDEO_INTERNAL_SERVICE_TOKEN:
        this.configService.get<string>('VIDEO_INTERNAL_SERVICE_TOKEN') ??
        'local-video-internal-token',
    };
  }

  private buildExitDetail(
    code: number | null,
    signal: NodeJS.Signals | null,
  ): string {
    return `exited with code ${code ?? 'unknown'} signal ${signal ?? 'none'}`;
  }
}
