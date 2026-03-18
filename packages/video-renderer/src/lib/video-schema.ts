import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { z } from 'zod';

export const VIDEO_RENDERER_COMPOSITION_ID = 'AqsharaVideo';
export const VIDEO_RENDERER_FPS = 30;

export const transitionSchema = z.enum(['none', 'fade', 'slide', 'wipe']);
export const templateSchema = z.enum([
  'hook',
  'problem',
  'mechanism',
  'evidence',
  'takeaway',
  'bullet',
  'title',
]);
const renderProfileSchema = z.enum(['480p', '720p']);

export const videoSceneSchema = z.object({
  sceneIndex: z.number().int().min(1),
  templateType: templateSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  bullets: z.array(z.string().min(1)).max(4).default([]),
  accentColor: z.string().min(1),
  durationInFrames: z.number().int().min(1),
  audioStaticFilePath: z.string().nullable(),
  transition: transitionSchema.default('fade'),
});

export const videoRenderSchema = z.object({
  videoJobId: z.string().min(1),
  topic: z.string().min(1),
  renderProfile: renderProfileSchema.default('720p'),
  scenes: z.array(videoSceneSchema).min(1),
});

export type VideoSceneProps = z.infer<typeof videoSceneSchema>;
export type VideoRenderProps = z.infer<typeof videoRenderSchema>;
export type VideoTemplateType = z.infer<typeof templateSchema>;

export const resolveDimensions = (
  renderProfile: VideoRenderProps['renderProfile'],
) => {
  if (renderProfile === '480p') {
    return { width: 854, height: 480 };
  }

  return { width: 1280, height: 720 };
};

export const getTransitionDuration = (
  transition: VideoSceneProps['transition'],
) => {
  return transition === 'none' ? 0 : 12;
};

export const getCompositionDurationInFrames = (props: VideoRenderProps) => {
  return props.scenes.reduce((total, scene, index) => {
    if (index === 0) {
      return total + scene.durationInFrames;
    }

    return total + scene.durationInFrames - getTransitionDuration(scene.transition);
  }, 0);
};

export const resolveTransitionPresentation = (
  transition: VideoSceneProps['transition'],
) => {
  if (transition === 'slide') {
    return slide({ direction: 'from-right' });
  }

  if (transition === 'wipe') {
    return wipe();
  }

  return fade();
};
