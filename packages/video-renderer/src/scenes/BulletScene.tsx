import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { TemplateScene } from '../components/TemplateScene';

export const BulletScene: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  return (
    <TemplateScene
      topic={topic}
      scene={scene}
      eyebrow="Key Points"
      surfaceColor="#101b28dd"
      chromeColor="#7dd3fc"
    />
  );
};
