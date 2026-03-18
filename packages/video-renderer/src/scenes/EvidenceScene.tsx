import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { TemplateScene } from '../components/TemplateScene';

export const EvidenceScene: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  return (
    <TemplateScene
      topic={topic}
      scene={scene}
      eyebrow="Evidence"
      surfaceColor="#15111fdd"
      chromeColor="#f5d0fe"
      bodyColor="#fae8ff"
    />
  );
};
