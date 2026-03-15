import {
  parseDocumentProcessJobPayload,
  parseTranslationRetryJobPayload,
} from '../pipeline-job.schemas';

describe('pipeline-job.schemas', () => {
  it('parses document.process payload', () => {
    const payload = parseDocumentProcessJobPayload({
      document_id: 'doc_1',
      actor_id: 'user_1',
      require_translate: true,
      request_id: 'req_1',
    });

    expect(payload).toEqual({
      document_id: 'doc_1',
      actor_id: 'user_1',
      require_translate: true,
      request_id: 'req_1',
    });
  });

  it('rejects invalid document.process payload', () => {
    expect(() =>
      parseDocumentProcessJobPayload({
        document_id: 'doc_1',
        actor_id: 'user_1',
        require_translate: 'true',
      }),
    ).toThrow('"require_translate" must be a boolean');
  });

  it('parses translation.retry payload', () => {
    const payload = parseTranslationRetryJobPayload({
      document_id: 'doc_1',
      paragraph_id: 'para_1',
      actor_id: 'user_1',
      request_id: null,
    });

    expect(payload).toEqual({
      document_id: 'doc_1',
      paragraph_id: 'para_1',
      actor_id: 'user_1',
      request_id: null,
    });
  });

  it('rejects invalid translation.retry payload', () => {
    expect(() =>
      parseTranslationRetryJobPayload({
        document_id: 'doc_1',
        actor_id: 'user_1',
      }),
    ).toThrow('"paragraph_id" must be a non-empty string');
  });
});
