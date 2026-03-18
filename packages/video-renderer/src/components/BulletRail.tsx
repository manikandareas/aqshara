import React from 'react';
import { Sequence } from 'remotion';
import { BulletCard } from './BulletCard';

export const BulletRail: React.FC<{
  accentColor: string;
  bullets: string[];
  durationInFrames: number;
}> = ({ accentColor, bullets, durationInFrames }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      {bullets.map((bullet, index) => (
        <Sequence
          key={`${index}-${bullet}`}
          from={10 + index * 6}
          durationInFrames={durationInFrames}
          premountFor={6}
        >
          <BulletCard accentColor={accentColor} label={bullet} index={index} />
        </Sequence>
      ))}
    </div>
  );
};
