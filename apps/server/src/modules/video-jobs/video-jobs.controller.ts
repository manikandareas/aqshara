import {
  Body,
  Controller,
  Get,
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
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import {
  CreateVideoJobRequestDto,
  RetryVideoJobRequestDto,
  VideoJobEnvelopeDto,
  VideoJobResultEnvelopeDto,
  VideoJobStatusEnvelopeDto,
  VideoJobStatusStreamEventDto,
} from './dto';
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
