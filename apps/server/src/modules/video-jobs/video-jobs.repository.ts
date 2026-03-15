import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import type {
  VideoGenerateCommand,
  VideoTransportEventType,
} from './video-transport.schemas';
import type {
  VideoPipelineStage,
  VideoQualityGate,
  VideoRenderProfile,
  VideoSceneStatus,
  VideoTemplateType,
} from './video-jobs.constants';

type VideoJobRow = {
  id: string;
  document_id: string;
  owner_id: string;
  status: string;
  pipeline_stage: string;
  progress_pct: number;
  target_duration_sec: number;
  voice: string;
  language: 'en' | 'id';
  retry_count: number;
  current_attempt: number;
  current_scene_index: number | null;
  fallback_used_count: number;
  render_profile: VideoRenderProfile;
  worker_id: string | null;
  accepted_at: Date | null;
  last_heartbeat_at: Date | null;
  lease_expires_at: Date | null;
  terminal_event_id: string | null;
  quality_gate: VideoQualityGate | null;
  error_code: string | null;
  error_message: string | null;
  final_video_object_key: string | null;
  final_thumbnail_object_key: string | null;
  bunny_library_id: string | null;
  bunny_video_id: string | null;
  bunny_status: number | null;
  duration_sec: number | null;
  resolution: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

type VideoJobOutboxRow = {
  id: string;
  video_job_id: string;
  topic: string;
  payload: VideoGenerateCommand;
  attempt_count: number;
  next_attempt_at: Date;
  last_error: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type VideoJobEventRow = {
  id: string;
  event_id: string;
  video_job_id: string;
  attempt: number;
  event_type: VideoTransportEventType;
  worker_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: Date;
  created_at: Date;
};

type SceneCountsRow = {
  total: string;
  done: string;
  failed: string;
  running: string;
  pending: string;
};

type StalledJobRow = {
  id: string;
  document_id: string;
  owner_id: string;
  retry_count: number;
  current_attempt: number;
  target_duration_sec: number;
  voice: string;
  language: 'en' | 'id';
  render_profile: VideoRenderProfile;
};

export type VideoJobRecord = VideoJobRow;
export type VideoJobOutboxRecord = VideoJobOutboxRow;

export type VideoSceneProgressInput = {
  sceneIndex: number;
  templateType?: VideoTemplateType | null;
  status: VideoSceneStatus;
  plannedDurationMs?: number | null;
  actualAudioDurationMs?: number | null;
  videoObjectKey?: string | null;
  audioObjectKey?: string | null;
  manimCodeObjectKey?: string | null;
  errorMessage?: string | null;
};

export type CreateVideoJobInput = {
  documentId: string;
  ownerId: string;
  targetDurationSec: number;
  voice: string;
  language: 'en' | 'id';
};

export type UpdateVideoJobProgressInput = {
  jobId: string;
  status: 'queued' | 'processing';
  pipelineStage: VideoPipelineStage;
  progressPct: number;
  currentSceneIndex?: number | null;
  fallbackIncrement?: number;
  renderProfile?: VideoRenderProfile;
  qualityGate?: VideoQualityGate;
};

export type InsertVideoTransportEventInput = {
  eventId: string;
  jobId: string;
  attempt: number;
  eventType: VideoTransportEventType;
  workerId?: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
};

@Injectable()
export class VideoJobsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createVideoJob(input: CreateVideoJobInput): Promise<VideoJobRow> {
    const id = randomUUID();
    const result = await this.databaseService.query<VideoJobRow>(
      `
      INSERT INTO video_jobs (
        id,
        document_id,
        owner_id,
        status,
        pipeline_stage,
        progress_pct,
        target_duration_sec,
        voice,
        language,
        retry_count,
        current_attempt,
        current_scene_index,
        fallback_used_count,
        render_profile,
        quality_gate
      ) VALUES (
        $1, $2, $3, 'queued', 'queued', 0, $4, $5, $6, 0, 1, NULL, 0, '720p', $7::jsonb
      )
      RETURNING *
      `,
      [
        id,
        input.documentId,
        input.ownerId,
        input.targetDurationSec,
        input.voice,
        input.language,
        JSON.stringify(this.defaultQualityGate()),
      ],
    );

    return result.rows[0]!;
  }

  async createVideoOutboxCommand(
    jobId: string,
    command: VideoGenerateCommand,
    options?: { client?: PoolClient; nextAttemptAt?: Date },
  ): Promise<void> {
    const nextAttemptAt = options?.nextAttemptAt ?? new Date();
    const query = options?.client
      ? options.client.query.bind(options.client)
      : this.databaseService.query.bind(this.databaseService);

    await query(
      `
      INSERT INTO video_job_outbox (
        id,
        video_job_id,
        topic,
        payload,
        attempt_count,
        next_attempt_at,
        last_error,
        published_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4::jsonb, 0, $5, NULL, NULL, now(), now()
      )
      `,
      [
        randomUUID(),
        jobId,
        command.topic,
        JSON.stringify(command),
        nextAttemptAt.toISOString(),
      ],
    );
  }

  async claimPendingOutbox(limit: number): Promise<VideoJobOutboxRow[]> {
    const result = await this.databaseService.query<VideoJobOutboxRow>(
      `
      WITH claimed AS (
        SELECT id
        FROM video_job_outbox
        WHERE published_at IS NULL
          AND next_attempt_at <= now()
        ORDER BY created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE video_job_outbox AS outbox
      SET
        attempt_count = outbox.attempt_count + 1,
        next_attempt_at = now() + interval '30 seconds',
        updated_at = now()
      FROM claimed
      WHERE outbox.id = claimed.id
      RETURNING outbox.*
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      ...row,
      payload: this.parseJson(row.payload) as VideoGenerateCommand,
    }));
  }

  async markOutboxPublished(outboxId: string): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_job_outbox
      SET
        published_at = now(),
        last_error = NULL,
        updated_at = now()
      WHERE id = $1
      `,
      [outboxId],
    );
  }

  async markOutboxFailed(
    outboxId: string,
    errorMessage: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_job_outbox
      SET
        last_error = $2,
        next_attempt_at = $3,
        updated_at = now()
      WHERE id = $1
      `,
      [outboxId, errorMessage, nextAttemptAt.toISOString()],
    );
  }

  async insertVideoTransportEvent(
    input: InsertVideoTransportEventInput,
  ): Promise<boolean> {
    const result = await this.databaseService.query<{ id: string }>(
      `
      INSERT INTO video_job_events (
        id,
        event_id,
        video_job_id,
        attempt,
        event_type,
        worker_id,
        payload,
        occurred_at,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, now()
      )
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
      `,
      [
        randomUUID(),
        input.eventId,
        input.jobId,
        input.attempt,
        input.eventType,
        input.workerId ?? null,
        JSON.stringify(input.payload),
        input.occurredAt,
      ],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async findOwnedVideoJobById(
    jobId: string,
    ownerId: string,
  ): Promise<VideoJobRow | null> {
    const result = await this.databaseService.query<VideoJobRow>(
      `
      SELECT *
      FROM video_jobs
      WHERE id = $1
        AND owner_id = $2
      LIMIT 1
      `,
      [jobId, ownerId],
    );

    return result.rows[0] ?? null;
  }

  async findVideoJobById(jobId: string): Promise<VideoJobRow | null> {
    const result = await this.databaseService.query<VideoJobRow>(
      `
      SELECT *
      FROM video_jobs
      WHERE id = $1
      LIMIT 1
      `,
      [jobId],
    );

    return result.rows[0] ?? null;
  }

  async findLatestActiveOwnedJobByDocumentId(
    documentId: string,
    ownerId: string,
  ): Promise<VideoJobRow | null> {
    const result = await this.databaseService.query<VideoJobRow>(
      `
      SELECT *
      FROM video_jobs
      WHERE document_id = $1
        AND owner_id = $2
        AND status IN ('queued', 'processing')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [documentId, ownerId],
    );

    return result.rows[0] ?? null;
  }

  async findLatestCompletedOwnedJobByDocumentId(
    documentId: string,
    ownerId: string,
  ): Promise<VideoJobRow | null> {
    const result = await this.databaseService.query<VideoJobRow>(
      `
      SELECT *
      FROM video_jobs
      WHERE document_id = $1
        AND owner_id = $2
        AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1
      `,
      [documentId, ownerId],
    );

    return result.rows[0] ?? null;
  }

  async markVideoJobAccepted(input: {
    jobId: string;
    attempt: number;
    workerId: string;
    leaseExpiresAt: Date;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = CASE WHEN status = 'queued' THEN 'processing' ELSE status END,
        worker_id = $3,
        accepted_at = COALESCE(accepted_at, now()),
        last_heartbeat_at = now(),
        lease_expires_at = $4,
        updated_at = now()
      WHERE id = $1
        AND current_attempt = $2
        AND status IN ('queued', 'processing')
      `,
      [input.jobId, input.attempt, input.workerId, input.leaseExpiresAt],
    );
  }

  async touchVideoJobHeartbeat(input: {
    jobId: string;
    attempt: number;
    workerId: string;
    leaseExpiresAt: Date;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        worker_id = $3,
        last_heartbeat_at = now(),
        lease_expires_at = $4,
        updated_at = now()
      WHERE id = $1
        AND current_attempt = $2
        AND status IN ('queued', 'processing')
      `,
      [input.jobId, input.attempt, input.workerId, input.leaseExpiresAt],
    );
  }

  async updateVideoJobProgress(
    input: UpdateVideoJobProgressInput,
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = $2,
        pipeline_stage = $3,
        progress_pct = GREATEST(progress_pct, $4),
        current_scene_index = COALESCE($5, current_scene_index),
        fallback_used_count = fallback_used_count + $6,
        render_profile = COALESCE($7, render_profile),
        quality_gate = COALESCE($8::jsonb, quality_gate),
        updated_at = now()
      WHERE id = $1
      `,
      [
        input.jobId,
        input.status,
        input.pipelineStage,
        input.progressPct,
        input.currentSceneIndex ?? null,
        input.fallbackIncrement ?? 0,
        input.renderProfile ?? null,
        input.qualityGate ? JSON.stringify(input.qualityGate) : null,
      ],
    );
  }

  async markVideoJobCompleted(input: {
    jobId: string;
    bunnyStatus?: number | null;
    terminalEventId?: string | null;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = 'completed',
        pipeline_stage = 'completed',
        progress_pct = 100,
        quality_gate = $2::jsonb,
        bunny_status = COALESCE($3, bunny_status),
        terminal_event_id = COALESCE($4, terminal_event_id),
        lease_expires_at = NULL,
        completed_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [
        input.jobId,
        JSON.stringify({
          storyboard_valid: true,
          code_valid: true,
          render_valid: true,
          audio_sync_valid: true,
        }),
        input.bunnyStatus ?? null,
        input.terminalEventId ?? null,
      ],
    );
  }

  async markVideoJobCompletedFromStorage(input: {
    jobId: string;
    finalVideoObjectKey: string;
    finalThumbnailObjectKey?: string | null;
    durationSec: number;
    resolution: string;
    terminalEventId?: string | null;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = 'completed',
        pipeline_stage = 'completed',
        progress_pct = 100,
        quality_gate = $5::jsonb,
        final_video_object_key = $2,
        final_thumbnail_object_key = $3,
        duration_sec = $4,
        resolution = $6,
        terminal_event_id = COALESCE($7, terminal_event_id),
        lease_expires_at = NULL,
        completed_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [
        input.jobId,
        input.finalVideoObjectKey,
        input.finalThumbnailObjectKey ?? null,
        input.durationSec,
        JSON.stringify({
          storyboard_valid: true,
          code_valid: true,
          render_valid: true,
          audio_sync_valid: true,
        }),
        input.resolution,
        input.terminalEventId ?? null,
      ],
    );
  }

  async markVideoJobStreamProcessing(input: {
    jobId: string;
    finalVideoObjectKey: string;
    finalThumbnailObjectKey?: string | null;
    durationSec: number;
    resolution: string;
    bunnyLibraryId: string;
    bunnyVideoId: string;
    bunnyStatus?: number | null;
    terminalEventId?: string | null;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = 'processing',
        pipeline_stage = 'stream_processing',
        progress_pct = GREATEST(progress_pct, 99),
        quality_gate = $5::jsonb,
        final_video_object_key = $2,
        final_thumbnail_object_key = $3,
        bunny_library_id = $4,
        bunny_video_id = $6,
        bunny_status = $7,
        duration_sec = $8,
        resolution = $9,
        terminal_event_id = COALESCE($10, terminal_event_id),
        updated_at = now()
      WHERE id = $1
      `,
      [
        input.jobId,
        input.finalVideoObjectKey,
        input.finalThumbnailObjectKey ?? null,
        input.bunnyLibraryId,
        JSON.stringify({
          storyboard_valid: true,
          code_valid: true,
          render_valid: true,
          audio_sync_valid: true,
        }),
        input.bunnyVideoId,
        input.bunnyStatus ?? null,
        input.durationSec,
        input.resolution,
        input.terminalEventId ?? null,
      ],
    );
  }

  async updateBunnyStreamStatus(input: {
    jobId: string;
    bunnyStatus: number;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        bunny_status = $2,
        updated_at = now()
      WHERE id = $1
      `,
      [input.jobId, input.bunnyStatus],
    );
  }

  async markVideoJobFailed(input: {
    jobId: string;
    pipelineStage: VideoPipelineStage;
    errorCode: string;
    errorMessage: string;
    failedSceneIndex?: number | null;
    terminalEventId?: string | null;
  }): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = 'failed',
        pipeline_stage = $2,
        error_code = $3,
        error_message = $4,
        current_scene_index = COALESCE($5, current_scene_index),
        terminal_event_id = COALESCE($6, terminal_event_id),
        lease_expires_at = NULL,
        updated_at = now()
      WHERE id = $1
      `,
      [
        input.jobId,
        input.pipelineStage,
        input.errorCode,
        input.errorMessage,
        input.failedSceneIndex ?? null,
        input.terminalEventId ?? null,
      ],
    );
  }

  async resetVideoJobForRetry(jobId: string): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      await this.deleteVideoArtifactsAndScenes(jobId, client);
      await client.query(
        `
        UPDATE video_jobs
        SET
          status = 'queued',
          pipeline_stage = 'queued',
          progress_pct = 0,
          retry_count = retry_count + 1,
          current_attempt = current_attempt + 1,
          current_scene_index = NULL,
          fallback_used_count = 0,
          worker_id = NULL,
          accepted_at = NULL,
          last_heartbeat_at = NULL,
          lease_expires_at = NULL,
          terminal_event_id = NULL,
          quality_gate = $2::jsonb,
          error_code = NULL,
          error_message = NULL,
          final_video_object_key = NULL,
          final_thumbnail_object_key = NULL,
          bunny_library_id = NULL,
          bunny_video_id = NULL,
          bunny_status = NULL,
          duration_sec = NULL,
          resolution = NULL,
          completed_at = NULL,
          updated_at = now()
        WHERE id = $1
        `,
        [jobId, JSON.stringify(this.defaultQualityGate())],
      );
    });
  }

  async failStalledJob(jobId: string, errorMessage: string): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE video_jobs
      SET
        status = 'failed',
        pipeline_stage = 'failed',
        error_code = 'VIDEO_WORKER_STALLED',
        error_message = $2,
        lease_expires_at = NULL,
        updated_at = now()
      WHERE id = $1
      `,
      [jobId, errorMessage],
    );
  }

  async findStalledJobs(
    leaseCutoff: Date,
    limit: number,
  ): Promise<StalledJobRow[]> {
    const result = await this.databaseService.query<StalledJobRow>(
      `
      SELECT
        id,
        document_id,
        owner_id,
        retry_count,
        current_attempt,
        target_duration_sec,
        voice,
        language,
        render_profile
      FROM video_jobs
      WHERE status IN ('queued', 'processing')
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < $1
      ORDER BY lease_expires_at ASC
      LIMIT $2
      `,
      [leaseCutoff.toISOString(), limit],
    );

    return result.rows;
  }

  async upsertScene(
    jobId: string,
    input: VideoSceneProgressInput,
  ): Promise<void> {
    await this.databaseService.query(
      `
      INSERT INTO video_job_scenes (
        id,
        video_job_id,
        scene_index,
        template_type,
        planned_duration_ms,
        actual_audio_duration_ms,
        render_status,
        retry_count,
        manim_code_object_key,
        audio_object_key,
        video_object_key,
        error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11
      )
      ON CONFLICT (video_job_id, scene_index)
      DO UPDATE SET
        template_type = COALESCE(EXCLUDED.template_type, video_job_scenes.template_type),
        planned_duration_ms = COALESCE(EXCLUDED.planned_duration_ms, video_job_scenes.planned_duration_ms),
        actual_audio_duration_ms = COALESCE(EXCLUDED.actual_audio_duration_ms, video_job_scenes.actual_audio_duration_ms),
        render_status = EXCLUDED.render_status,
        manim_code_object_key = COALESCE(EXCLUDED.manim_code_object_key, video_job_scenes.manim_code_object_key),
        audio_object_key = COALESCE(EXCLUDED.audio_object_key, video_job_scenes.audio_object_key),
        video_object_key = COALESCE(EXCLUDED.video_object_key, video_job_scenes.video_object_key),
        error_message = COALESCE(EXCLUDED.error_message, video_job_scenes.error_message),
        updated_at = now()
      `,
      [
        randomUUID(),
        jobId,
        input.sceneIndex,
        input.templateType ?? null,
        input.plannedDurationMs ?? null,
        input.actualAudioDurationMs ?? null,
        input.status,
        input.manimCodeObjectKey ?? null,
        input.audioObjectKey ?? null,
        input.videoObjectKey ?? null,
        input.errorMessage ?? null,
      ],
    );
  }

  async addArtifacts(jobId: string, objectKeys: string[]): Promise<void> {
    for (const objectKey of objectKeys) {
      await this.databaseService.query(
        `
        INSERT INTO video_job_artifacts (
          id,
          video_job_id,
          artifact_type,
          object_key,
          content_type
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          randomUUID(),
          jobId,
          this.getArtifactType(objectKey),
          objectKey,
          this.getContentType(objectKey),
        ],
      );
    }
  }

  async getSceneCounts(jobId: string): Promise<{
    total: number;
    done: number;
    failed: number;
    running: number;
    pending: number;
  }> {
    const result = await this.databaseService.query<SceneCountsRow>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE render_status = 'done')::text AS done,
        COUNT(*) FILTER (WHERE render_status = 'error')::text AS failed,
        COUNT(*) FILTER (WHERE render_status = 'processing')::text AS running,
        COUNT(*) FILTER (WHERE render_status = 'pending')::text AS pending
      FROM video_job_scenes
      WHERE video_job_id = $1
      `,
      [jobId],
    );

    const row = result.rows[0];

    return {
      total: Number.parseInt(row?.total ?? '0', 10),
      done: Number.parseInt(row?.done ?? '0', 10),
      failed: Number.parseInt(row?.failed ?? '0', 10),
      running: Number.parseInt(row?.running ?? '0', 10),
      pending: Number.parseInt(row?.pending ?? '0', 10),
    };
  }

  private async deleteVideoArtifactsAndScenes(
    jobId: string,
    client: PoolClient,
  ): Promise<void> {
    await client.query(`DELETE FROM video_job_scenes WHERE video_job_id = $1`, [
      jobId,
    ]);
    await client.query(
      `DELETE FROM video_job_artifacts WHERE video_job_id = $1`,
      [jobId],
    );
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (!value) {
      return {};
    }

    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }

    return value as Record<string, unknown>;
  }

  private defaultQualityGate(): VideoQualityGate {
    return {
      storyboard_valid: false,
      code_valid: false,
      render_valid: false,
      audio_sync_valid: false,
    };
  }

  private getContentType(objectKey: string): string {
    if (objectKey.endsWith('.json')) {
      return 'application/json';
    }

    if (objectKey.endsWith('.md')) {
      return 'text/markdown';
    }

    if (objectKey.endsWith('.wav')) {
      return 'audio/wav';
    }

    if (objectKey.endsWith('.log')) {
      return 'text/plain';
    }

    if (objectKey.endsWith('.mp4')) {
      return 'video/mp4';
    }

    return 'application/octet-stream';
  }

  private getArtifactType(objectKey: string): string {
    if (objectKey.endsWith('/summary.json')) {
      return 'summary';
    }

    if (
      objectKey.endsWith('/storyboard.json') ||
      objectKey.endsWith('/scenes.md')
    ) {
      return 'storyboard';
    }

    if (objectKey.endsWith('/merge.log')) {
      return 'merge_log';
    }

    if (objectKey.endsWith('/render.log')) {
      return 'render_log';
    }

    if (objectKey.endsWith('.wav')) {
      return 'audio';
    }

    return 'debug_bundle';
  }
}
