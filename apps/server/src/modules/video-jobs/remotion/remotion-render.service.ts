import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { VideoRenderProps } from './video-renderer.types';

const DEFAULT_COMPOSITION_ID = 'AqsharaVideo';
const RENDER_ASSET_PREFIX = 'video-jobs';

@Injectable()
export class RemotionRenderService {
  private publicAssetRootPromise: Promise<string> | null = null;
  private bundleLocationPromise: Promise<string> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async renderVideo(input: {
    props: VideoRenderProps;
    outputLocation: string;
    onProgress?: (progress: number) => Promise<void> | void;
  }): Promise<void> {
    const serveUrl = await this.getBundleLocation();
    const composition = await selectComposition({
      serveUrl,
      id: this.configService.get<string>(
        'VIDEO_REMOTION_COMPOSITION_ID',
        DEFAULT_COMPOSITION_ID,
      ),
      inputProps: input.props,
    });

    await renderMedia({
      serveUrl,
      composition,
      codec: 'h264',
      outputLocation: input.outputLocation,
      inputProps: input.props,
      onProgress: ({ progress }) => input.onProgress?.(progress),
    });
  }

  async stageAudioAsset(input: {
    videoJobId: string;
    fileName: string;
    content: Buffer;
  }): Promise<string> {
    const publicDir = await this.getPublicAssetRoot();
    const relativePath = `${RENDER_ASSET_PREFIX}/${input.videoJobId}/audio/${input.fileName}`;
    const absolutePath = join(publicDir, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content);

    return relativePath;
  }

  async cleanupJobAssets(videoJobId: string): Promise<void> {
    const publicDir = await this.getPublicAssetRoot();
    await rm(join(publicDir, RENDER_ASSET_PREFIX, videoJobId), {
      recursive: true,
      force: true,
    });
  }

  private async getBundleLocation(): Promise<string> {
    if (!this.bundleLocationPromise) {
      this.bundleLocationPromise = this.createBundleLocation();
    }

    return this.bundleLocationPromise;
  }

  private async getPublicAssetRoot(): Promise<string> {
    if (!this.publicAssetRootPromise) {
      this.publicAssetRootPromise = this.initializePublicAssetRoot();
    }

    return this.publicAssetRootPromise;
  }

  private async initializePublicAssetRoot(): Promise<string> {
    const publicDir = join(tmpdir(), 'aqshara-remotion-public');
    await mkdir(publicDir, { recursive: true });
    await rm(join(publicDir, RENDER_ASSET_PREFIX), {
      recursive: true,
      force: true,
    });
    await mkdir(join(publicDir, RENDER_ASSET_PREFIX), { recursive: true });
    return publicDir;
  }

  private async createBundleLocation(): Promise<string> {
    const publicDir = await this.getPublicAssetRoot();
    return bundle({
      entryPoint: this.resolveEntryPoint(),
      publicDir,
    });
  }

  private resolveEntryPoint() {
    const configuredEntry = this.configService.get<string>(
      'VIDEO_REMOTION_ENTRY',
    );

    if (configuredEntry && configuredEntry.trim().length > 0) {
      return configuredEntry;
    }

    return resolve(this.resolveRendererRoot(), 'src/index.ts');
  }

  private resolveRendererRoot() {
    const candidates = [
      resolve(process.cwd(), 'packages/video-renderer'),
      resolve(process.cwd(), '../../packages/video-renderer'),
      resolve(__dirname, '../../../../../packages/video-renderer'),
    ];

    const existing = candidates.find((candidate) => existsSync(candidate));

    if (!existing) {
      throw new Error('Unable to resolve Remotion renderer workspace');
    }

    return existing;
  }
}
