import { NotFoundException } from '@nestjs/common';
import { DocumentsRepository } from '../../documents/documents.repository';
import { EngagementRepository } from '../engagement.repository';
import { EngagementService } from '../engagement.service';

describe('EngagementService', () => {
  const findOwnedDocumentByIdMock = jest.fn();
  const createFeedbackMock = jest.fn();
  const insertEventsBatchMock = jest.fn();

  const engagementRepository = {
    createFeedback: createFeedbackMock,
    insertEventsBatch: insertEventsBatchMock,
  } as unknown as EngagementRepository;

  const documentsRepository = {
    findOwnedDocumentById: findOwnedDocumentByIdMock,
  } as unknown as DocumentsRepository;

  const service = new EngagementService(
    engagementRepository,
    documentsRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates rating feedback and returns created payload', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({ id: 'doc_1' });
    createFeedbackMock.mockResolvedValue({
      id: 'fb_1',
      type: 'rating',
      created_at: new Date('2026-03-10T00:00:00.000Z'),
    });

    await expect(
      service.createFeedback('doc_1', 'user_1', {
        type: 'rating',
        rating: 5,
        comment: 'Great output',
      }),
    ).resolves.toEqual({
      data: {
        id: 'fb_1',
        type: 'rating',
        created_at: '2026-03-10T00:00:00.000Z',
      },
    });

    expect(createFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user_1',
        documentId: 'doc_1',
        type: 'rating',
        rating: 5,
      }),
    );
  });

  it('creates issue feedback and maps nullable fields', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({ id: 'doc_1' });
    createFeedbackMock.mockResolvedValue({
      id: 'fb_2',
      type: 'issue',
      created_at: new Date('2026-03-10T00:10:00.000Z'),
    });

    await service.createFeedback('doc_1', 'user_1', {
      type: 'issue',
      issue_type: 'translation',
      description: 'Wrong terminology',
      paragraph_id: 'p_1',
    });

    expect(createFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user_1',
        documentId: 'doc_1',
        type: 'issue',
        rating: null,
        issueType: 'translation',
        description: 'Wrong terminology',
        paragraphId: 'p_1',
      }),
    );
  });

  it('returns not found when feedback document is not owned', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue(null);

    await expect(
      service.createFeedback('doc_1', 'user_1', {
        type: 'rating',
        rating: 4,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ingests valid events and returns accepted count', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({ id: 'doc_1' });
    insertEventsBatchMock.mockResolvedValue(2);

    await expect(
      service.ingestEvents('user_1', {
        events: [
          {
            type: 'document.opened',
            timestamp: '2026-03-10T01:00:00.000Z',
            payload: { source: 'reader' },
            document_id: 'doc_1',
          },
          {
            type: 'session.ping',
            timestamp: '2026-03-10T01:05:00.000Z',
            payload: { active: true },
          },
        ],
      }),
    ).resolves.toEqual({
      data: {
        accepted: 2,
      },
    });

    expect(insertEventsBatchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects entire event batch when one document is not owned', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue(null);

    await expect(
      service.ingestEvents('user_1', {
        events: [
          {
            type: 'document.opened',
            timestamp: '2026-03-10T01:00:00.000Z',
            payload: {},
            document_id: 'doc_missing',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(insertEventsBatchMock).not.toHaveBeenCalled();
  });
});
