import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentsRepository } from '../documents/documents.repository';
import { EventsRequestDto, FeedbackRequestDto } from './dto';
import {
  EngagementRepository,
  type EventInsertInput,
} from './engagement.repository';
import type {
  AcceptedEventsPayload,
  FeedbackCreateData,
} from './engagement.types';

@Injectable()
export class EngagementService {
  constructor(
    private readonly engagementRepository: EngagementRepository,
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async createFeedback(
    documentId: string,
    actorId: string,
    request: FeedbackRequestDto,
  ): Promise<{ data: FeedbackCreateData }> {
    await this.assertOwnedDocument(documentId, actorId);

    const created = await this.engagementRepository.createFeedback({
      actorId,
      documentId,
      type: request.type,
      rating: request.type === 'rating' ? (request.rating ?? null) : null,
      comment: request.comment ?? null,
      issueType: request.type === 'issue' ? (request.issue_type ?? null) : null,
      description:
        request.type === 'issue' ? (request.description ?? null) : null,
      paragraphId: request.paragraph_id ?? null,
    });

    return {
      data: {
        id: created.id,
        type: created.type,
        created_at: created.created_at.toISOString(),
      },
    };
  }

  async ingestEvents(
    actorId: string,
    request: EventsRequestDto,
  ): Promise<{ data: AcceptedEventsPayload }> {
    await this.assertOwnedDocumentsForEvents(actorId, request.events);

    const rows: EventInsertInput[] = request.events.map((event) => ({
      actorId,
      documentId: event.document_id ?? null,
      type: event.type,
      timestamp: new Date(event.timestamp),
      payload: event.payload,
    }));

    const accepted = await this.engagementRepository.insertEventsBatch(rows);

    return {
      data: {
        accepted,
      },
    };
  }

  private async assertOwnedDocument(
    documentId: string,
    actorId: string,
  ): Promise<void> {
    const document = await this.documentsRepository.findOwnedDocumentById(
      documentId,
      actorId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }
  }

  private async assertOwnedDocumentsForEvents(
    actorId: string,
    events: EventsRequestDto['events'],
  ): Promise<void> {
    const uniqueDocumentIds = [
      ...new Set(
        events
          .map((event) => event.document_id)
          .filter((documentId): documentId is string =>
            Boolean(documentId && documentId.length > 0),
          ),
      ),
    ];

    const ownershipChecks = await Promise.all(
      uniqueDocumentIds.map((documentId) =>
        this.documentsRepository.findOwnedDocumentById(documentId, actorId),
      ),
    );

    const hasUnownedDocument = ownershipChecks.some((document) => !document);
    if (hasUnownedDocument) {
      throw new NotFoundException('Document not found');
    }
  }
}
