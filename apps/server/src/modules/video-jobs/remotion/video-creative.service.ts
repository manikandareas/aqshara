import { Injectable } from '@nestjs/common';
import { AiService } from '../../../infrastructure/ai/ai.service';
import {
  buildCreativeInputText,
  buildNarrativeFromCreativePlan,
  buildVideoNarrative,
  extractNarrativeSource,
} from './video-storyboard.builder';
import type {
  BuiltVideoNarrative,
  VideoCreativePlan,
} from './video-renderer.types';

@Injectable()
export class VideoCreativeService {
  constructor(private readonly aiService: AiService) {}

  async planNarrative(input: {
    ocrResult: unknown;
    targetDurationSec: number;
    targetLanguage: 'en' | 'id';
  }): Promise<{
    narrative: BuiltVideoNarrative;
    creativePlanArtifact: Record<string, unknown>;
    fallbackApplied: boolean;
    fallbackReason: string | null;
  }> {
    const source = extractNarrativeSource(input.ocrResult);

    try {
      const creativePlan = await this.aiService.generateVideoCreativePlan({
        topic: source.topic,
        targetDurationSec: input.targetDurationSec,
        targetLanguage: input.targetLanguage,
        sourceExcerptCount: source.summary.source_excerpt_count,
        sourceText: buildCreativeInputText(source.paragraphs),
      });

      const narrative = buildNarrativeFromCreativePlan(
        creativePlan,
        input.targetDurationSec,
      );

      return {
        narrative,
        creativePlanArtifact: {
          source: 'ai',
          creative_plan: creativePlan,
        },
        fallbackApplied: false,
        fallbackReason: null,
      };
    } catch (error) {
      const narrative = buildVideoNarrative(
        input.ocrResult,
        input.targetDurationSec,
      );

      return {
        narrative,
        creativePlanArtifact: {
          source: 'heuristic_fallback',
          fallback_reason:
            error instanceof Error ? error.message : 'AI creative failed',
          creative_plan: {
            topic: narrative.topic,
            summary: narrative.summary,
            scenes: narrative.scenes.map((scene) => ({
              sceneIndex: scene.sceneIndex,
              templateType: scene.templateType,
              title: scene.title,
              body: scene.body,
              bullets: scene.bullets,
              narrationText: scene.narrationText,
              transition: scene.transition,
              accentColor: scene.accentColor,
              emphasisTerms: [],
            })),
          } satisfies VideoCreativePlan,
        },
        fallbackApplied: true,
        fallbackReason:
          error instanceof Error ? error.message : 'AI creative failed',
      };
    }
  }
}
