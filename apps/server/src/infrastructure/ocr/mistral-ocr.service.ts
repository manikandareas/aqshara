import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { withTimeout } from '../../common/utils/with-timeout.util';
import {
  DEFAULT_MISTRAL_OCR_MODEL,
  DEFAULT_MISTRAL_TIMEOUT_MS,
} from './ocr.constants';

type MistralOcrPage = {
  index?: number;
  markdown?: string;
  dimensions?: {
    dpi?: number;
    height?: number;
    width?: number;
  };
  images?: Array<{
    id?: string;
    top_left_x?: number;
    top_left_y?: number;
    bottom_right_x?: number;
    bottom_right_y?: number;
    image_base64?: string;
  }>;
};

export type MistralOcrResult = {
  model?: string;
  pages?: MistralOcrPage[];
  usage_info?: {
    pages_processed?: number;
    doc_size_bytes?: number;
  };
};

@Injectable()
export class MistralOcrService {
  private readonly client: Mistral;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new Mistral({
      apiKey: this.configService.getOrThrow<string>('MISTRAL_API_KEY'),
    });

    this.model = this.configService.get<string>(
      'MISTRAL_OCR_MODEL',
      DEFAULT_MISTRAL_OCR_MODEL,
    );

    this.timeoutMs = this.configService.get<number>(
      'MISTRAL_TIMEOUT_MS',
      DEFAULT_MISTRAL_TIMEOUT_MS,
    );
  }

  async processPdf(
    documentId: string,
    filename: string,
    fileBuffer: Buffer,
  ): Promise<MistralOcrResult> {
    const uploadedFile = await withTimeout(
      this.client.files.upload({
        file: {
          fileName: filename || `${documentId}.pdf`,
          content: fileBuffer,
        },
        purpose: 'ocr',
      }),
      this.timeoutMs,
      'Mistral file upload timed out',
    );

    if (!uploadedFile.id) {
      throw new Error('Mistral OCR upload returned no file ID');
    }

    const signedUrl = await withTimeout(
      this.client.files.getSignedUrl({
        fileId: uploadedFile.id,
      }),
      this.timeoutMs,
      'Mistral signed URL retrieval timed out',
    );

    if (!signedUrl.url) {
      throw new Error('Mistral OCR signed URL is missing');
    }

    const response = await withTimeout(
      this.client.ocr.process({
        model: this.model,
        includeImageBase64: true,
        document: {
          type: 'document_url',
          documentUrl: signedUrl.url,
        },
      }),
      this.timeoutMs,
      'Mistral OCR processing timed out',
    );

    return response as MistralOcrResult;
  }
}
