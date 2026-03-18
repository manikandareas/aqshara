import type {
  BuiltVideoNarrative,
  BuiltVideoScene,
  VideoCreativePlan,
  VideoCreativeSummary,
} from './video-renderer.types';

const SCENE_WEIGHTS = [0.16, 0.2, 0.26, 0.22, 0.16];
const SCENE_COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#f97316', '#a78bfa'];
const DEFAULT_TEMPLATE_ORDER: BuiltVideoScene['templateType'][] = [
  'hook',
  'problem',
  'mechanism',
  'evidence',
  'takeaway',
];
const DEFAULT_TRANSITION_ORDER: BuiltVideoScene['transition'][] = [
  'fade',
  'slide',
  'wipe',
  'fade',
  'none',
];

type NarrativeSource = {
  topic: string;
  paragraphs: string[];
  summary: VideoCreativeSummary;
};

export function buildVideoNarrative(
  ocrResult: unknown,
  targetDurationSec: number,
): BuiltVideoNarrative {
  const source = extractNarrativeSource(ocrResult);

  const plan: VideoCreativePlan = {
    topic: source.topic,
    summary: source.summary,
    scenes: [
      makeCreativeScenePlan(
        1,
        'hook',
        source.summary.topic,
        source.summary.problem,
        'fade',
      ),
      makeCreativeScenePlan(
        2,
        'problem',
        'Why This Matters',
        source.summary.problem,
        'slide',
      ),
      makeCreativeScenePlan(
        3,
        'mechanism',
        'How It Works',
        source.summary.method,
        'wipe',
      ),
      makeCreativeScenePlan(
        4,
        'evidence',
        'What The Results Show',
        source.summary.result,
        'fade',
      ),
      makeCreativeScenePlan(
        5,
        'takeaway',
        'Key Takeaway',
        source.summary.takeaway,
        'none',
      ),
    ],
  };

  return buildNarrativeFromCreativePlan(plan, targetDurationSec);
}

export function buildNarrativeFromCreativePlan(
  plan: VideoCreativePlan,
  targetDurationSec: number,
): BuiltVideoNarrative {
  validateCreativePlan(plan);
  const durations = allocateDurations(targetDurationSec, plan.scenes.length);

  const scenes: BuiltVideoScene[] = plan.scenes.map((scene, index) => ({
    sceneIndex: scene.sceneIndex,
    templateType: scene.templateType,
    title: sentenceExcerpt(scene.title, 10),
    body: sentenceExcerpt(scene.body, 28),
    bullets: scene.bullets
      .map((bullet) => sentenceExcerpt(bullet, 10))
      .filter((bullet) => bullet.length > 0)
      .slice(0, 3),
    accentColor:
      scene.accentColor?.trim() ||
      SCENE_COLORS[index % SCENE_COLORS.length] ||
      '#38bdf8',
    narrationText: sentenceExcerpt(scene.narrationText, 50),
    transition: scene.transition,
    durationInFrames: Math.max(
      60,
      Math.round((durations[index] ?? 6) * 30),
    ),
    audioStaticFilePath: null,
    audioObjectKey: null,
    actualAudioDurationMs: null,
  }));

  return {
    topic: sentenceExcerpt(plan.topic, 10),
    summary: plan.summary,
    storyboard: {
      topic: plan.topic,
      estimated_length_sec: targetDurationSec,
      scenes: plan.scenes.map((scene, index) => ({
        scene_index: scene.sceneIndex,
        template_type: scene.templateType,
        title: scene.title,
        body: scene.body,
        bullets: scene.bullets,
        narration_text: scene.narrationText,
        emphasis_terms: scene.emphasisTerms ?? [],
        planned_duration_ms: Math.round((durations[index] ?? 6) * 1000),
        transition_strategy: scene.transition,
      })),
    },
    scenesMarkdown: renderScenesMarkdown(plan.topic, scenes),
    scenes,
  };
}

export function extractNarrativeSource(ocrResult: unknown): NarrativeSource {
  const pages = extractPages(ocrResult);
  const paragraphs = extractParagraphs(pages);

  if (paragraphs.length === 0) {
    throw new Error('OCR artifact does not contain usable markdown paragraphs');
  }

  const topic = extractTopic(pages, paragraphs);
  const summary: VideoCreativeSummary = {
    topic,
    hook: selectParagraph(
      paragraphs,
      ['abstract', 'introduction', 'problem', 'motivation'],
      0,
    ),
    problem: selectParagraph(
      paragraphs,
      ['problem', 'challenge', 'motivation', 'introduction'],
      0,
    ),
    method: selectParagraph(
      paragraphs,
      ['method', 'approach', 'we propose', 'we present', 'pipeline'],
      Math.min(1, paragraphs.length - 1),
    ),
    result: selectParagraph(
      paragraphs,
      ['result', 'evaluation', 'experiment', 'accuracy', 'performance'],
      Math.max(0, Math.floor(paragraphs.length / 2)),
    ),
    takeaway: selectParagraph(
      paragraphs,
      ['conclusion', 'future work', 'discussion', 'summary'],
      paragraphs.length - 1,
    ),
    source_excerpt_count: paragraphs.length,
  };

  return {
    topic,
    paragraphs,
    summary,
  };
}

export function buildCreativeInputText(paragraphs: string[], maxParagraphs = 10) {
  return paragraphs
    .slice(0, maxParagraphs)
    .map((paragraph, index) => `Excerpt ${index + 1}: ${paragraph}`)
    .join('\n\n');
}

function validateCreativePlan(plan: VideoCreativePlan) {
  if (!Array.isArray(plan.scenes) || plan.scenes.length !== 5) {
    throw new Error('Creative plan must contain exactly 5 scenes');
  }

  for (const [index, scene] of plan.scenes.entries()) {
    if (scene.sceneIndex !== index + 1) {
      throw new Error('Creative plan scenes must use sequential scene indexes');
    }
    if (!DEFAULT_TEMPLATE_ORDER.includes(scene.templateType)) {
      throw new Error(`Unsupported creative template type: ${scene.templateType}`);
    }
    if (!DEFAULT_TRANSITION_ORDER.includes(scene.transition)) {
      throw new Error(`Unsupported creative transition: ${scene.transition}`);
    }
    if (!scene.title.trim() || !scene.body.trim() || !scene.narrationText.trim()) {
      throw new Error('Creative plan scene content is incomplete');
    }
  }
}

function makeCreativeScenePlan(
  sceneIndex: number,
  templateType: BuiltVideoScene['templateType'],
  title: string,
  paragraph: string,
  transition: BuiltVideoScene['transition'],
): VideoCreativePlan['scenes'][number] {
  const body = sentenceExcerpt(paragraph, 28);
  const bullets = toBullets(paragraph);

  return {
    sceneIndex,
    templateType,
    title: sentenceExcerpt(title, 10),
    body,
    bullets,
    narrationText: [body, ...bullets].join(' ').trim(),
    transition,
    accentColor: SCENE_COLORS[(sceneIndex - 1) % SCENE_COLORS.length]!,
    emphasisTerms: bullets.slice(0, 2),
  };
}

function allocateDurations(targetDurationSec: number, count: number) {
  const weights = SCENE_WEIGHTS.slice(0, count);
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      const assigned = weights.slice(0, -1).reduce(
        (total, value) => total + Math.round(targetDurationSec * value),
        0,
      );
      return Math.max(6, targetDurationSec - assigned);
    }

    return Math.max(6, Math.round(targetDurationSec * weight));
  });
}

function extractPages(ocrResult: unknown): Array<Record<string, unknown>> {
  if (!ocrResult || typeof ocrResult !== 'object') {
    return [];
  }

  const pages = (ocrResult as { pages?: unknown }).pages;
  return Array.isArray(pages)
    ? pages.filter(
        (page): page is Record<string, unknown> =>
          !!page && typeof page === 'object',
      )
    : [];
}

function extractParagraphs(pages: Array<Record<string, unknown>>) {
  const paragraphs: string[] = [];

  for (const page of pages) {
    const markdown = typeof page.markdown === 'string' ? page.markdown : '';
    if (!markdown) {
      continue;
    }

    for (const chunk of markdown.split(/\n\s*\n/g)) {
      const normalized = chunk
        .replace(/[#>*`_\-]+/g, ' ')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

      if (normalized.length >= 60) {
        paragraphs.push(normalized);
      }
    }
  }

  return paragraphs;
}

function extractTopic(
  pages: Array<Record<string, unknown>>,
  paragraphs: string[],
) {
  for (const page of pages) {
    const markdown = typeof page.markdown === 'string' ? page.markdown : '';
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch?.[1]) {
      return sentenceExcerpt(titleMatch[1], 10);
    }
  }

  return sentenceExcerpt(paragraphs[0] ?? 'Research video', 10);
}

function selectParagraph(
  paragraphs: string[],
  keywords: string[],
  fallbackIndex: number,
) {
  for (const paragraph of paragraphs) {
    const lower = paragraph.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return paragraph;
    }
  }

  return paragraphs[fallbackIndex] ?? paragraphs[0] ?? '';
}

function sentenceExcerpt(input: string, maxWords: number) {
  return input
    .split(/\s+/)
    .slice(0, maxWords)
    .join(' ')
    .replace(/[,:;]+$/g, '')
    .trim();
}

function toBullets(paragraph: string) {
  const parts = paragraph
    .split(/[.?!]\s+/)
    .map((part) => sentenceExcerpt(part, 10))
    .filter((part) => part.length > 0);

  return parts.slice(0, 3);
}

function renderScenesMarkdown(topic: string, scenes: BuiltVideoScene[]) {
  return [
    `# ${topic}`,
    '',
    ...scenes.flatMap((scene) => [
      `## Scene ${scene.sceneIndex}: ${scene.title}`,
      `- template: ${scene.templateType}`,
      `- narration: ${scene.narrationText}`,
      `- bullets: ${scene.bullets.join(' | ') || 'none'}`,
      '',
    ]),
  ].join('\n');
}
