import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../infrastructure/ai/ai.service';
import { ReaderMarkdownService } from '../reader/reader-markdown.service';
import { ReaderService } from '../reader/reader.service';
import type { TranslationRetryJobPayload } from './pipeline-job.schemas';

@Injectable()
export class PipelineTranslationRetryProcessorService {
  private readonly logger = new Logger(
    PipelineTranslationRetryProcessorService.name,
  );

  constructor(
    private readonly readerService: ReaderService,
    private readonly aiService: AiService,
    private readonly readerMarkdownService: ReaderMarkdownService,
  ) {}

  async process(job: TranslationRetryJobPayload): Promise<void> {
    this.logger.log({
      message: 'Starting translation retry processing',
      request_id: job.request_id ?? null,
      document_id: job.document_id,
      paragraph_id: job.paragraph_id,
      actor_id: job.actor_id,
    });

    const context = await this.readerService.getTranslationRetryContext(
      job.document_id,
      job.paragraph_id,
    );

    try {
      let textEn: string | null = null;
      let textEnMd: string | null = null;
      let textId: string | null = null;
      let textIdMd: string | null = null;
      const sourceMarkdown = context.textRawMd || context.textRaw;

      if (context.sourceLang === 'en') {
        textIdMd = await this.aiService.translateMarkdown({
          markdown: sourceMarkdown,
          targetLang: 'id',
        });
        textId = this.readerMarkdownService.stripMarkdown(textIdMd);
      } else if (context.sourceLang === 'id') {
        textEnMd = await this.aiService.translateMarkdown({
          markdown: sourceMarkdown,
          targetLang: 'en',
        });
        textEn = this.readerMarkdownService.stripMarkdown(textEnMd);
      } else {
        [textEnMd, textIdMd] = await Promise.all([
          this.aiService.translateMarkdown({
            markdown: sourceMarkdown,
            targetLang: 'en',
          }),
          this.aiService.translateMarkdown({
            markdown: sourceMarkdown,
            targetLang: 'id',
          }),
        ]);
        textEn = this.readerMarkdownService.stripMarkdown(textEnMd);
        textId = this.readerMarkdownService.stripMarkdown(textIdMd);
      }

      await this.readerService.completeTranslationRetry(
        job.document_id,
        context.paragraphId,
        {
          textEn,
          textEnMd,
          textId,
          textIdMd,
        },
      );
    } catch (error) {
      this.logger.error({
        message: 'Translation retry processing failed',
        request_id: job.request_id ?? null,
        document_id: job.document_id,
        paragraph_id: job.paragraph_id,
        actor_id: job.actor_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.readerService.failTranslationRetry(
        job.document_id,
        job.paragraph_id,
      );
      throw error;
    }
  }

  async processDlq(job: TranslationRetryJobPayload): Promise<void> {
    this.logger.error({
      message: 'Processing translation DLQ terminal path',
      request_id: job.request_id ?? null,
      document_id: job.document_id,
      paragraph_id: job.paragraph_id,
      actor_id: job.actor_id,
    });
    await this.readerService.failTranslationRetry(
      job.document_id,
      job.paragraph_id,
    );
  }
}
