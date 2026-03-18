import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { TemplateScene } from '../components/TemplateScene';

export const TakeawayScene: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  return (
    <TemplateScene
      topic={topic}
      scene={scene}
      eyebrow="Takeaway"
      surfaceColor="#1a1f15dd"
      chromeColor="#fde68a"
      bodyColor="#fef3c7"
    />
  );
};
