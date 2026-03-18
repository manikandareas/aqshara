import { AiService } from '../../../infrastructure/ai/ai.service';
import { VideoCreativeService } from '../remotion/video-creative.service';

describe('VideoCreativeService', () => {
  const generateVideoCreativePlanMock = jest.fn();

  const aiService = {
    generateVideoCreativePlan: generateVideoCreativePlanMock,
  } as unknown as AiService;

  const service = new VideoCreativeService(aiService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses AI creative output when it is valid', async () => {
    generateVideoCreativePlanMock.mockResolvedValue({
      topic: 'Transformers',
      summary: {
        topic: 'Transformers',
        hook: 'Transformers changed sequence modeling.',
        problem: 'RNNs forget long-range context.',
        method: 'Attention links tokens directly.',
        result: 'Transformers scale better across tasks.',
        takeaway: 'Attention is the key primitive.',
        source_excerpt_count: 8,
      },
      scenes: [
        {
          sceneIndex: 1,
          templateType: 'hook',
          title: 'Why Transformers Matter',
          body: 'Transformers changed sequence modeling.',
          bullets: ['Attention', 'Scale'],
          narrationText: 'Transformers changed sequence modeling.',
          transition: 'fade',
        },
        {
          sceneIndex: 2,
          templateType: 'problem',
          title: 'The Problem',
          body: 'RNNs forget long-range context.',
          bullets: ['Long context', 'Sequential bottleneck'],
          narrationText: 'RNNs forget long-range context.',
          transition: 'slide',
        },
        {
          sceneIndex: 3,
          templateType: 'mechanism',
          title: 'The Mechanism',
          body: 'Attention links tokens directly.',
          bullets: ['Queries', 'Keys', 'Values'],
          narrationText: 'Attention links tokens directly.',
          transition: 'wipe',
        },
        {
          sceneIndex: 4,
          templateType: 'evidence',
          title: 'The Evidence',
          body: 'Transformers scale better across tasks.',
          bullets: ['Quality', 'Scale'],
          narrationText: 'Transformers scale better across tasks.',
          transition: 'fade',
        },
        {
          sceneIndex: 5,
          templateType: 'takeaway',
          title: 'The Takeaway',
          body: 'Attention is the key primitive.',
          bullets: ['Flexible', 'Scalable'],
          narrationText: 'Attention is the key primitive.',
          transition: 'none',
        },
      ],
    });

    const result = await service.planNarrative({
      ocrResult: {
        pages: [
          {
            markdown:
              '# Transformers\n\nTransformers changed sequence modeling by scaling attention. RNNs forget long-range context. Attention links tokens directly. Results improved across tasks. The key takeaway is that attention became the default primitive.',
          },
        ],
      },
      targetDurationSec: 60,
      targetLanguage: 'en',
    });

    expect(result.fallbackApplied).toBe(false);
    expect(result.narrative.topic).toBe('Transformers');
    expect(result.creativePlanArtifact.source).toBe('ai');
  });

  it('falls back to heuristic planning when AI creative fails', async () => {
    generateVideoCreativePlanMock.mockRejectedValue(
      new Error('OpenAI video creative response is not valid JSON'),
    );

    const result = await service.planNarrative({
      ocrResult: {
        pages: [
          {
            markdown:
              '# Transformers\n\nTransformers changed sequence modeling by scaling attention. RNNs forget long-range context over long sequences. Attention links tokens directly and improves scaling. Results improved across tasks and models. The key takeaway is that attention became the default primitive.',
          },
        ],
      },
      targetDurationSec: 60,
      targetLanguage: 'en',
    });

    expect(result.fallbackApplied).toBe(true);
    expect(result.fallbackReason).toContain('not valid JSON');
    expect(result.narrative.scenes).toHaveLength(5);
    expect(result.creativePlanArtifact.source).toBe('heuristic_fallback');
  });
});
