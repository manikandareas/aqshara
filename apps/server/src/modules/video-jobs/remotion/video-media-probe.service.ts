import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { withTimeout } from '../../../common/utils/with-timeout.util';

@Injectable()
export class VideoMediaProbeService {
  private readonly ffprobeBinary: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.ffprobeBinary = this.configService.get<string>(
      'FFPROBE_BINARY',
      'ffprobe',
    );
    this.timeoutMs =
      this.configService.get<number>('VIDEO_RENDER_TIMEOUT_SEC', 180) * 1000;
  }

  async getAudioDurationMs(
    buffer: Buffer,
    extension: 'mp3' | 'wav',
  ): Promise<number> {
    const workspace = await mkdtemp(join(tmpdir(), 'aqshara-audio-probe-'));
    const inputPath = join(workspace, `audio.${extension}`);

    try {
      await writeFile(inputPath, buffer);
      const durationSec = await this.getDurationSec(inputPath);
      return Math.round(durationSec * 1000);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  async getVideoDurationSec(filePath: string): Promise<number> {
    return this.getDurationSec(filePath);
  }

  private async getDurationSec(filePath: string): Promise<number> {
    const stdout = await withTimeout(
      new Promise<string>((resolve, reject) => {
        const child = spawn(
          this.ffprobeBinary,
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            filePath,
          ],
          {
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (chunk: Buffer | string) => {
          output += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer | string) => {
          errorOutput += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) {
            resolve(output);
            return;
          }

          reject(
            new Error(
              errorOutput.trim() ||
                `ffprobe exited with code ${code ?? 'unknown'}`,
            ),
          );
        });
      }),
      this.timeoutMs,
      'ffprobe timed out',
    );

    const durationSec = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('Unable to determine media duration');
    }

    return durationSec;
  }
}
