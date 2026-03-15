import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ApiErrorEnvelopeDto } from '../../openapi/swagger.schemas';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { DOCUMENT_STATUSES } from './documents.constants';
import {
  DocumentDetailEnvelopeDto,
  DocumentItemEnvelopeDto,
  DocumentListEnvelopeDto,
  DocumentStatusEnvelopeDto,
  DocumentStatusStreamEventDto,
  ListDocumentsQueryDto,
  UploadDocumentBodyDto,
  UploadDocumentRequestDto,
} from './dto';
import { DocumentsService, type UploadDocumentFile } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth('bearer')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents' })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { default: 1, minimum: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { default: 20, minimum: 1, maximum: 100 },
  })
  @ApiQuery({
    name: 'status',
    required: false,
    schema: { type: 'string', enum: [...DOCUMENT_STATUSES] },
  })
  @ApiOkResponse({ type: DocumentListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  async listDocuments(
    @CurrentUserId() userId: string,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.documentsService.listDocuments({
      ownerId: userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentRequestDto })
  @ApiAcceptedResponse({ type: DocumentItemEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  async uploadDocument(
    @CurrentUserId() userId: string,
    @UploadedFile() file: UploadDocumentFile | undefined,
    @Body() body: UploadDocumentBodyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documentsService.uploadDocument({
      ownerId: userId,
      file: file as UploadDocumentFile,
      requireTranslate: body.require_translate ?? false,
      requireVideoGeneration: body.require_video_generation ?? false,
      requestId: typeof request.id === 'string' ? request.id : undefined,
    });
  }

  @Get(':document_id')
  @ApiOperation({ summary: 'Get document detail' })
  @ApiParam({ name: 'document_id' })
  @ApiOkResponse({ type: DocumentDetailEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  async getDocument(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
  ) {
    return this.documentsService.getDocument(documentId, userId);
  }

  @Delete(':document_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete document' })
  @ApiParam({ name: 'document_id' })
  @ApiNoContentResponse({ description: 'Document deleted' })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  async deleteDocument(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
  ): Promise<void> {
    await this.documentsService.deleteDocument(documentId, userId);
  }

  @Get(':document_id/status')
  @ApiOperation({ summary: 'Get document pipeline status' })
  @ApiParam({ name: 'document_id' })
  @ApiOkResponse({ type: DocumentStatusEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  async getDocumentStatus(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
  ) {
    return this.documentsService.getDocumentStatus(documentId, userId);
  }

  @Sse(':document_id/status/stream')
  @ApiOperation({ summary: 'Stream document status updates via SSE' })
  @ApiParam({ name: 'document_id' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ type: DocumentStatusStreamEventDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  streamDocumentStatus(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
  ): Observable<MessageEvent> {
    return this.documentsService.streamDocumentStatus(documentId, userId);
  }
}
