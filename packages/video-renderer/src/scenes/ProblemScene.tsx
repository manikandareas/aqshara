import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { TemplateScene } from '../components/TemplateScene';

export const ProblemScene: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  return (
    <TemplateScene
      topic={topic}
      scene={scene}
      eyebrow="Problem"
      surfaceColor="#0c1a25dd"
      chromeColor="#fca5a5"
      bodyColor="#e2e8f0"
    />
  );
};
