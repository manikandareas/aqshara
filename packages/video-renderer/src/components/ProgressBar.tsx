import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const ProgressBar: React.FC<{ accentColor: string }> = ({
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fill = interpolate(frame, [0, durationInFrames], [0.1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        backgroundColor: '#10283d',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${fill * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${accentColor}, #f8fafc)`,
        }}
      />
    </div>
  );
};
