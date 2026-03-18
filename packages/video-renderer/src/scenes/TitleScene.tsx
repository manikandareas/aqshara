import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { TemplateScene } from '../components/TemplateScene';

export const TitleScene: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  return (
    <TemplateScene
      topic={topic}
      scene={scene}
      eyebrow="Overview"
      surfaceColor="#111827dd"
      chromeColor="#c4b5fd"
      bodyColor="#ede9fe"
    />
  );
};
