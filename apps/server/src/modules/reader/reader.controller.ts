import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { ApiErrorEnvelopeDto } from '../../openapi/swagger.schemas';
import {
  GlossaryDetailEnvelopeDto,
  GlossaryLookupEnvelopeDto,
  MapNodeDetailEnvelopeDto,
  MapTreeEnvelopeDto,
  GlossaryListEnvelopeDto,
  OutlineEnvelopeDto,
  ParagraphDetailEnvelopeDto,
  ParagraphListEnvelopeDto,
  ReaderGlossaryLookupQueryDto,
  ReaderGlossaryQueryDto,
  ReaderParagraphsQueryDto,
  ReaderSearchQueryDto,
  ReaderTranslationsQueryDto,
  SearchEnvelopeDto,
  TranslationRetryEnvelopeDto,
  TranslationsListEnvelopeDto,
} from './dto';
import { ReaderService } from './reader.service';

@ApiTags('Reader')
@ApiBearerAuth('bearer')
@Controller('documents')
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Get(':document_id/outline')
  @ApiOperation({ summary: 'Get outline tree for a ready document' })
  @ApiParam({ name: 'document_id' })
  @ApiOkResponse({ type: OutlineEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  getOutline(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
  ) {
    return this.readerService.getOutline(documentId, userId);
  }

  @Get(':document_id/paragraphs')
  @ApiOperation({ summary: 'List document paragraphs' })
  @ApiParam({ name: 'document_id' })
  @ApiQuery({ name: 'section_id', required: false, schema: { type: 'string' } })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { default: 1, minimum: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { default: 20, minimum: 1, maximum: 200 },
  })
  @ApiOkResponse({ type: ParagraphListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  listParagraphs(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Query() query: ReaderParagraphsQueryDto,
  ) {
    return this.readerService.listParagraphs({
      documentId,
      ownerId: userId,
      sectionId: query.section_id,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':document_id/paragraphs/:paragraph_id')
  @ApiOperation({ summary: 'Get paragraph detail' })
  @ApiParam({ name: 'document_id' })
  @ApiParam({ name: 'paragraph_id' })
  @ApiOkResponse({ type: ParagraphDetailEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  getParagraphDetail(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Param('paragraph_id') paragraphId: string,
  ) {
    return this.readerService.getParagraphDetail(
      documentId,
      paragraphId,
      userId,
    );
  }

  @Get(':document_id/search')
  @ApiOperation({ summary: 'Search paragraph text' })
  @ApiParam({ name: 'document_id' })
  @ApiQuery({ name: 'q', required: true, schema: { type: 'string' } })
  @ApiQuery({
    name: 'lang',
    required: false,
    schema: { default: 'en', enum: ['en', 'id'] },
  })
  @ApiOkResponse({ type: SearchEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  searchParagraphs(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Query() query: ReaderSearchQueryDto,
  ) {
    return this.readerService.searchParagraphs(
      documentId,
      userId,
      query.q,
      query.lang ?? 'en',
    );
  }

  @Get(':document_id/translations')
  @ApiOperation({ summary: 'List paragraph translations' })
  @ApiParam({ name: 'document_id' })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { default: 1, minimum: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { default: 20, minimum: 1, maximum: 200 },
  })
  @ApiQuery({
    name: 'status',
    required: false,
    schema: { enum: ['pending', 'done', 'error'] },
  })
  @ApiOkResponse({ type: TranslationsListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  listTranslations(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Query() query: ReaderTranslationsQueryDto,
  ) {
    return this.readerService.listTranslations({
      documentId,
      ownerId: userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
  }

  @Get(':document_id/glossary')
  @ApiOperation({ summary: 'List glossary terms' })
  @ApiParam({ name: 'document_id' })
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
    name: 'sort',
    required: false,
    schema: { default: 'frequency', enum: ['frequency', 'alphabetical'] },
  })
  @ApiOkResponse({ type: GlossaryListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  listGlossary(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Query() query: ReaderGlossaryQueryDto,
  ) {
    return this.readerService.listGlossary({
      documentId,
      ownerId: userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sort: query.sort ?? 'frequency',
    });
  }

  @Get(':document_id/glossary/lookup')
  @ApiOperation({ summary: 'Lookup glossary term by text' })
  @ApiParam({ name: 'document_id' })
  @ApiQuery({ name: 'term', required: true, schema: { type: 'string' } })
  @ApiQuery({
    name: 'lang',
    required: false,
    schema: { default: 'en', enum: ['en', 'id'] },
  })
  @ApiOkResponse({ type: GlossaryLookupEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  lookupGlossaryTerm(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Query() query: ReaderGlossaryLookupQueryDto,
  ) {
    return this.readerService.lookupGlossaryTerm({
      documentId,
      ownerId: userId,
      term: query.term,
      lang: query.lang ?? 'en',
    });
  }

  @Get(':document_id/glossary/:term_id')
  @ApiOperation({ summary: 'Get glossary term detail' })
  @ApiParam({ name: 'document_id' })
  @ApiParam({ name: 'term_id' })
  @ApiOkResponse({ type: GlossaryDetailEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  getGlossaryTerm(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Param('term_id') termId: string,
  ) {
    return this.readerService.getGlossaryTerm(documentId, termId, userId);
  }

  @Get(':document_id/map')
  @ApiOperation({ summary: 'Get map tree' })
  @ApiParam({ name: 'document_id' })
  @ApiOkResponse({ type: MapTreeEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  getMapTree(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
  ) {
    return this.readerService.getMapTree(documentId, userId);
  }

  @Get(':document_id/map/:node_id')
  @ApiOperation({ summary: 'Get map node detail' })
  @ApiParam({ name: 'document_id' })
  @ApiParam({ name: 'node_id' })
  @ApiOkResponse({ type: MapNodeDetailEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  getMapNodeDetail(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Param('node_id') nodeId: string,
  ) {
    return this.readerService.getMapNodeDetail(documentId, nodeId, userId);
  }

  @Post(':document_id/translations/:paragraph_id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Retry translation for a paragraph' })
  @ApiParam({ name: 'document_id' })
  @ApiParam({ name: 'paragraph_id' })
  @ApiAcceptedResponse({ type: TranslationRetryEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorEnvelopeDto })
  retryTranslation(
    @CurrentUserId() userId: string,
    @Param('document_id') documentId: string,
    @Param('paragraph_id') paragraphId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.readerService.enqueueTranslationRetry({
      documentId,
      paragraphId,
      ownerId: userId,
      requestId: typeof request.id === 'string' ? request.id : undefined,
    });
  }
}
