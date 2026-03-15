import { StorageService } from '../../../infrastructure/storage/storage.service';
import { ReaderMarkdownService } from '../reader-markdown.service';

describe('ReaderMarkdownService', () => {
  const uploadObjectMock = jest.fn();
  const createDocumentAssetKeyMock = jest.fn();
  const createObjectUrlMock = jest.fn();

  const storageService = {
    uploadObject: uploadObjectMock,
    createDocumentAssetKey: createDocumentAssetKeyMock,
    createObjectUrl: createObjectUrlMock,
  } as unknown as StorageService;

  const service = new ReaderMarkdownService(storageService);

  beforeEach(() => {
    jest.clearAllMocks();
    createDocumentAssetKeyMock.mockReturnValue(
      'documents/doc_1/assets/doc_1_p_1_hash.jpg',
    );
    createObjectUrlMock.mockReturnValue('https://cdn.local/doc_1_p_1_hash.jpg');
  });

  it('uploads OCR image references and rewrites markdown to public URLs', async () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    const result = await service.rewriteMarkdownAssets({
      documentId: 'doc_1',
      paragraphId: 'doc_1_p_1',
      markdown: 'See ![Figure](img-0.jpeg)',
      pageImages: {
        'img-0.jpeg': jpegBytes.toString('base64'),
      },
    });

    expect(uploadObjectMock).toHaveBeenCalledWith(
      'documents/doc_1/assets/doc_1_p_1_hash.jpg',
      expect.any(Buffer),
      'image/jpeg',
    );
    expect(result.markdown).toBe(
      'See ![Figure](https://cdn.local/doc_1_p_1_hash.jpg)',
    );
    expect(result.warnings).toEqual([]);
  });

  it('neutralizes unsupported relative links', async () => {
    const result = await service.rewriteMarkdownAssets({
      documentId: 'doc_1',
      paragraphId: 'doc_1_p_2',
      markdown: 'Read [appendix](appendix.pdf)',
      pageImages: {},
    });

    expect(uploadObjectMock).not.toHaveBeenCalled();
    expect(result.markdown).toBe('Read [appendix](#)');
    expect(result.warnings[0]?.code).toBe('ocr_link_reference_invalid');
  });

  it('strips markdown into plain text', () => {
    expect(
      service.stripMarkdown('Hello [world](https://example.com) ![Figure](x.jpg)'),
    ).toBe('Hello world');
  });
});
