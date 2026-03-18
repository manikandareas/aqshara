import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { withTimeout } from '../../../common/utils/with-timeout.util';
import { AUDIO_INSTRUCTIONS } from '../video-jobs.constants';

@Injectable()
export class VideoNarrationService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly responseFormat: 'mp3' | 'wav';
  private readonly timeoutMs: number;
  private readonly estimatedWordsPerMinute: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.model = this.configService.get<string>(
      'VIDEO_TTS_MODEL',
      'gpt-4o-mini-tts',
    );
    this.responseFormat = this.configService.get<'mp3' | 'wav'>(
      'VIDEO_TTS_RESPONSE_FORMAT',
      'mp3',
    );
    this.timeoutMs = this.configService.get<number>(
      'VIDEO_TTS_TIMEOUT_MS',
      60_000,
    );
    this.estimatedWordsPerMinute = this.configService.get<number>(
      'VIDEO_TTS_ESTIMATED_WPM',
      145,
    );
  }

  async synthesize(input: { text: string; voice: string }): Promise<{
    audioBytes: Buffer;
    contentType: string;
    fileExtension: 'mp3' | 'wav';
    durationMs: number;
  }> {
    const response = await withTimeout(
      this.client.audio.speech.create({
        model: this.model,
        voice: input.voice as
          | 'alloy'
          | 'ash'
          | 'ballad'
          | 'coral'
          | 'echo'
          | 'sage'
          | 'shimmer'
          | 'verse'
          | 'marin'
          | 'cedar',
        input: `
       <narration_instructions>
        Read this summary as if telling an important scientific story.
        Start with a sense of curiosity.
        Build momentum when explaining the method and findings.
        Slow down slightly on technical terms.
        End with a reflective, meaningful takeaway.
       </narration_instructions>
       <narration_text>
        ${input.text}
       </narration_text>
        `,
        response_format: this.responseFormat,
        instructions: AUDIO_INSTRUCTIONS,
      }),
      this.timeoutMs,
      'OpenAI TTS timed out',
    );

    const audioBytes = Buffer.from(await response.arrayBuffer());
    const durationMs = this.estimateDurationMs(input.text);

    return {
      audioBytes,
      contentType: this.getContentType(),
      durationMs,
      fileExtension: this.responseFormat,
    };
  }

  private getContentType(): string {
    if (this.responseFormat === 'wav') {
      return 'audio/wav';
    }

    return 'audio/mpeg';
  }

  private estimateDurationMs(text: string): number {
    const wordCount = text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    if (wordCount === 0) {
      return 2_000;
    }

    const minutes = wordCount / Math.max(this.estimatedWordsPerMinute, 1);
    return Math.max(2_000, Math.round(minutes * 60_000));
  }
}
