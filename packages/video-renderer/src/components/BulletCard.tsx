import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const BulletCard: React.FC<{
  accentColor: string;
  index: number;
  label: string;
}> = ({ accentColor, index, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    fps,
    frame,
    config: { damping: 200 },
    durationInFrames: 14,
  });
  const y = interpolate(entrance, [0, 1], [20, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        padding: '22px 24px',
        borderRadius: 24,
        backgroundColor: '#0b2234cc',
        border: `1px solid ${accentColor}44`,
        transform: `translateY(${y}px)`,
        opacity,
      }}
    >
      <div
        style={{
          minWidth: 40,
          width: 40,
          height: 40,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          backgroundColor: accentColor,
          color: '#021018',
          fontWeight: 700,
          fontSize: 18,
        }}
      >
        {index + 1}
      </div>
      <div
        style={{
          fontSize: 22,
          lineHeight: 1.35,
          color: '#e2e8f0',
        }}
      >
        {label}
      </div>
    </div>
  );
};
