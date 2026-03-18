import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { TemplateScene } from '../components/TemplateScene';

export const MechanismScene: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  return (
    <TemplateScene
      topic={topic}
      scene={scene}
      eyebrow="Mechanism"
      surfaceColor="#071f24dd"
      chromeColor="#86efac"
      bodyColor="#dcfce7"
    />
  );
};
