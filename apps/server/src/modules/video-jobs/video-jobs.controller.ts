import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ApiErrorEnvelopeDto } from '../../openapi/swagger.schemas';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import {
  CreateVideoJobRequestDto,
  InternalVideoCompleteDto,
  InternalVideoFailDto,
  InternalVideoProgressDto,
  RetryVideoJobRequestDto,
  VideoJobEnvelopeDto,
  VideoJobResultEnvelopeDto,
  VideoJobStatusEnvelopeDto,
  VideoJobStatusStreamEventDto,
} from './dto';
import {
  VIDEO_INTERNAL_IDEMPOTENCY_HEADER,
  VIDEO_INTERNAL_TOKEN_HEADER,
} from './video-jobs.constants';
import { VideoJobsInternalAuthService } from './video-jobs-internal-auth.service';
import { VideoJobsService } from './video-jobs.service';

@ApiTags('Video Jobs')
@ApiBearerAuth('bearer')
@Controller('video-jobs')
export class VideoJobsController {
  constructor(private readonly videoJobsService: VideoJobsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create or reuse a video generation job' })
  @ApiAcceptedResponse({ type: VideoJobEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  createVideoJob(
    @CurrentUserId() userId: string,
    @Body() body: CreateVideoJobRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.videoJobsService.createVideoJob({
      ...body,
      ownerId: userId,
      requestId: typeof request.id === 'string' ? request.id : undefined,
    });
  }

  @Get(':job_id')
  @ApiOperation({ summary: 'Get video job detail' })
  @ApiParam({ name: 'job_id' })
  @ApiOkResponse({ type: VideoJobEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  getVideoJob(@CurrentUserId() userId: string, @Param('job_id') jobId: string) {
    return this.videoJobsService.getVideoJob(jobId, userId);
  }

  @Get(':job_id/status')
  @ApiOperation({ summary: 'Get video job status snapshot' })
  @ApiParam({ name: 'job_id' })
  @ApiOkResponse({ type: VideoJobStatusEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  getVideoJobStatus(
    @CurrentUserId() userId: string,
    @Param('job_id') jobId: string,
  ) {
    return this.videoJobsService.getVideoJobStatus(jobId, userId);
  }

  @Sse(':job_id/status/stream')
  @ApiOperation({ summary: 'Stream video job status updates via SSE' })
  @ApiParam({ name: 'job_id' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ type: VideoJobStatusStreamEventDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  streamVideoJobStatus(
    @CurrentUserId() userId: string,
    @Param('job_id') jobId: string,
  ): Observable<MessageEvent> {
    return this.videoJobsService.streamVideoJobStatus(jobId, userId);
  }

  @Post(':job_id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Retry a failed video job' })
  @ApiParam({ name: 'job_id' })
  @ApiAcceptedResponse({ type: VideoJobEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  retryVideoJob(
    @CurrentUserId() userId: string,
    @Param('job_id') jobId: string,
    @Body() body: RetryVideoJobRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.videoJobsService.retryVideoJob(
      jobId,
      userId,
      typeof request.id === 'string' ? request.id : undefined,
    );
  }

  @Get(':job_id/result')
  @ApiOperation({ summary: 'Get final video result' })
  @ApiParam({ name: 'job_id' })
  @ApiOkResponse({ type: VideoJobResultEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  getVideoJobResult(
    @CurrentUserId() userId: string,
    @Param('job_id') jobId: string,
  ) {
    return this.videoJobsService.getVideoJobResult(jobId, userId);
  }
}

@ApiTags('Internal Video Jobs')
@Public()
@Controller('internal/video-jobs')
export class InternalVideoJobsController {
  constructor(
    private readonly videoJobsService: VideoJobsService,
    private readonly internalAuthService: VideoJobsInternalAuthService,
  ) {}

  @Post(':job_id/progress')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record video job progress from worker callbacks' })
  @ApiParam({ name: 'job_id' })
  @ApiHeader({ name: VIDEO_INTERNAL_TOKEN_HEADER })
  @ApiHeader({ name: VIDEO_INTERNAL_IDEMPOTENCY_HEADER, required: false })
  @ApiNoContentResponse()
  async updateProgress(
    @Param('job_id') jobId: string,
    @Body() body: InternalVideoProgressDto,
    @Headers(VIDEO_INTERNAL_TOKEN_HEADER) token: string | undefined,
    @Headers(VIDEO_INTERNAL_IDEMPOTENCY_HEADER) idempotencyKey:
      | string
      | undefined,
  ): Promise<void> {
    this.internalAuthService.assertValid(token);
    await this.videoJobsService.applyInternalProgress(jobId, body, idempotencyKey);
  }

  @Post(':job_id/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a video job as completed' })
  @ApiParam({ name: 'job_id' })
  @ApiHeader({ name: VIDEO_INTERNAL_TOKEN_HEADER })
  @ApiHeader({ name: VIDEO_INTERNAL_IDEMPOTENCY_HEADER, required: false })
  @ApiNoContentResponse()
  async markComplete(
    @Param('job_id') jobId: string,
    @Body() body: InternalVideoCompleteDto,
    @Headers(VIDEO_INTERNAL_TOKEN_HEADER) token: string | undefined,
    @Headers(VIDEO_INTERNAL_IDEMPOTENCY_HEADER) idempotencyKey:
      | string
      | undefined,
  ): Promise<void> {
    this.internalAuthService.assertValid(token);
    await this.videoJobsService.applyInternalComplete(jobId, body, idempotencyKey);
  }

  @Post(':job_id/fail')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a video job as failed' })
  @ApiParam({ name: 'job_id' })
  @ApiHeader({ name: VIDEO_INTERNAL_TOKEN_HEADER })
  @ApiHeader({ name: VIDEO_INTERNAL_IDEMPOTENCY_HEADER, required: false })
  @ApiNoContentResponse()
  async markFailed(
    @Param('job_id') jobId: string,
    @Body() body: InternalVideoFailDto,
    @Headers(VIDEO_INTERNAL_TOKEN_HEADER) token: string | undefined,
    @Headers(VIDEO_INTERNAL_IDEMPOTENCY_HEADER) idempotencyKey:
      | string
      | undefined,
  ): Promise<void> {
    this.internalAuthService.assertValid(token);
    await this.videoJobsService.applyInternalFail(jobId, body, idempotencyKey);
  }
}
