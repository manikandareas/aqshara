import React from 'react';
import type { VideoSceneProps } from '../lib/video-schema';
import { BulletScene } from './BulletScene';
import { EvidenceScene } from './EvidenceScene';
import { HookScene } from './HookScene';
import { MechanismScene } from './MechanismScene';
import { ProblemScene } from './ProblemScene';
import { TakeawayScene } from './TakeawayScene';
import { TitleScene } from './TitleScene';

export const SceneRenderer: React.FC<{
  topic: string;
  scene: VideoSceneProps;
}> = ({ topic, scene }) => {
  switch (scene.templateType) {
    case 'hook':
      return <HookScene topic={topic} scene={scene} />;
    case 'problem':
      return <ProblemScene topic={topic} scene={scene} />;
    case 'mechanism':
      return <MechanismScene topic={topic} scene={scene} />;
    case 'evidence':
      return <EvidenceScene topic={topic} scene={scene} />;
    case 'takeaway':
      return <TakeawayScene topic={topic} scene={scene} />;
    case 'bullet':
      return <BulletScene topic={topic} scene={scene} />;
    case 'title':
      return <TitleScene topic={topic} scene={scene} />;
    default:
      return <HookScene topic={topic} scene={scene} />;
  }
};
