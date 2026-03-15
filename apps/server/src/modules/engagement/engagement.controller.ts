import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import {
  AcceptedEventsEnvelopeDto,
  FeedbackCreateEnvelopeDto,
  EventsRequestDto,
  FeedbackRequestDto,
} from './dto';
import { ApiErrorEnvelopeDto } from '../../openapi/swagger.schemas';
import { EngagementService } from './engagement.service';

@ApiTags('Engagement')
@ApiBearerAuth('bearer')
@Controller()
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('documents/:document_id/feedback')
  @ApiOperation({ summary: 'Submit feedback for a document' })
  @ApiParam({ name: 'document_id' })
  @ApiBody({ type: FeedbackRequestDto })
  @ApiOkResponse({ type: FeedbackCreateEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  createFeedback(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Body() body: FeedbackRequestDto,
  ) {
    return this.engagementService.createFeedback(documentId, userId, body);
  }

  @Post('events')
  @ApiOperation({ summary: 'Ingest client events' })
  @ApiBody({ type: EventsRequestDto })
  @ApiOkResponse({ type: AcceptedEventsEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  ingestEvents(
    @CurrentUserId() userId: string,
    @Body() body: EventsRequestDto,
  ) {
    return this.engagementService.ingestEvents(userId, body);
  }
}
