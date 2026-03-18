import { Audio } from '@remotion/media';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import React from 'react';
import { AbsoluteFill, Easing, staticFile } from 'remotion';
import { videoFontFamily } from './lib/font';
import {
  getCompositionDurationInFrames,
  getTransitionDuration,
  resolveDimensions,
  resolveTransitionPresentation,
  VIDEO_RENDERER_COMPOSITION_ID,
  VIDEO_RENDERER_FPS,
  videoRenderSchema,
  videoSceneSchema,
  type VideoRenderProps,
  type VideoSceneProps,
} from './lib/video-schema';
import { SceneRenderer } from './scenes/SceneRenderer';

export {
  getCompositionDurationInFrames,
  getTransitionDuration,
  resolveDimensions,
  VIDEO_RENDERER_COMPOSITION_ID,
  VIDEO_RENDERER_FPS,
  videoRenderSchema,
  videoSceneSchema,
};

export type { VideoRenderProps, VideoSceneProps };

export const VideoRenderer: React.FC<VideoRenderProps> = ({ topic, scenes }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#04121c',
        color: '#f8fafc',
        fontFamily: videoFontFamily,
      }}
    >
      <TransitionSeries>
        {scenes.map((scene, index) => (
          <React.Fragment key={`${scene.sceneIndex}-${scene.title}`}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <SceneRenderer topic={topic} scene={scene} />
              {scene.audioStaticFilePath ? (
                <Audio src={staticFile(scene.audioStaticFilePath)} />
              ) : null}
            </TransitionSeries.Sequence>
            {index < scenes.length - 1 && scene.transition !== 'none' ? (
              <TransitionSeries.Transition
                presentation={resolveTransitionPresentation(scene.transition)}
                timing={linearTiming({
                  durationInFrames: getTransitionDuration(scene.transition),
                  easing: Easing.inOut(Easing.cubic),
                })}
              />
            ) : null}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
