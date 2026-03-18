import { registerRoot } from 'remotion';
import { RemotionRoot } from './root';

registerRoot(RemotionRoot);

export {
  VIDEO_RENDERER_COMPOSITION_ID,
  VIDEO_RENDERER_FPS,
  getTransitionDuration,
  resolveDimensions,
  type VideoRenderProps,
  type VideoSceneProps,
  videoRenderSchema,
} from './video-renderer';
export { RemotionRoot } from './root';
