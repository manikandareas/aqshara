import React from 'react';
import { Composition } from 'remotion';
import {
  VIDEO_RENDERER_COMPOSITION_ID,
  VIDEO_RENDERER_FPS,
  VideoRenderer,
  getCompositionDurationInFrames,
  resolveDimensions,
  type VideoRenderProps,
  videoRenderSchema,
} from './video-renderer';

export const RemotionRoot: React.FC = () => {
  const { width, height } = resolveDimensions('720p');

  return (
    <Composition
      id={VIDEO_RENDERER_COMPOSITION_ID}
      component={VideoRenderer}
      durationInFrames={VIDEO_RENDERER_FPS * 60}
      fps={VIDEO_RENDERER_FPS}
      width={width}
      height={height}
      defaultProps={defaultVideoProps}
      schema={videoRenderSchema}
      calculateMetadata={({ props }) => {
        const renderProps = props as VideoRenderProps;
        const dimensions = resolveDimensions(renderProps.renderProfile);

        return {
          durationInFrames: getCompositionDurationInFrames(renderProps),
          fps: VIDEO_RENDERER_FPS,
          width: dimensions.width,
          height: dimensions.height,
          defaultOutName: `${renderProps.videoJobId}.mp4`,
        };
      }}
    />
  );
};

const defaultVideoProps: VideoRenderProps = {
  videoJobId: 'preview-job',
  topic: 'Preview video',
  renderProfile: '720p',
  scenes: [
    {
      sceneIndex: 1,
      templateType: 'hook',
      title: 'Preview hook',
      body: 'This preview exists to make sure the renderer boots correctly.',
      bullets: ['Remotion SSR', 'Typed props', 'Deterministic templates'],
      accentColor: '#3b82f6',
      durationInFrames: VIDEO_RENDERER_FPS * 6,
      audioStaticFilePath: null,
      transition: 'fade',
    },
  ],
};
