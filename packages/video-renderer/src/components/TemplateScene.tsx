import { fitText } from '@remotion/layout-utils';
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { videoFontFamily } from '../lib/font';
import type { VideoSceneProps } from '../lib/video-schema';
import { BulletRail } from './BulletRail';
import { ProgressBar } from './ProgressBar';

export type TemplateSceneProps = {
  topic: string;
  scene: VideoSceneProps;
  eyebrow: string;
  surfaceColor: string;
  textColor?: string;
  bodyColor?: string;
  chromeColor?: string;
};

export const TemplateScene: React.FC<TemplateSceneProps> = ({
  topic,
  scene,
  eyebrow,
  surfaceColor,
  textColor = '#f8fafc',
  bodyColor = '#dbeafe',
  chromeColor = '#93c5fd',
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = spring({
    fps,
    frame,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const bodyOpacity = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const panelX = interpolate(enter, [0, 1], [48, 0]);
  const haloScale = interpolate(frame, [0, 20], [0.9, 1.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleFontSize = Math.min(
    fitText({
      text: scene.title,
      withinWidth: width * 0.72,
      fontFamily: videoFontFamily,
      fontWeight: '700',
    }).fontSize,
    width * 0.07,
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at top left, ${scene.accentColor}30, transparent 38%), linear-gradient(135deg, #04121c 0%, #0f172a 100%)`,
        color: textColor,
        fontFamily: videoFontFamily,
        padding: 64,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 32,
          right: 32,
          width: 220,
          height: 220,
          borderRadius: 999,
          background: `radial-gradient(circle, ${scene.accentColor}25 0%, transparent 65%)`,
          transform: `scale(${haloScale})`,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: scene.bullets.length > 0 ? '1.4fr 1fr' : '1fr',
          gap: 32,
          height: '100%',
          transform: `translateX(${panelX}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 40,
            borderRadius: 36,
            backgroundColor: surfaceColor,
            border: `1px solid ${scene.accentColor}55`,
            boxShadow: `0 24px 80px ${scene.accentColor}20`,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: chromeColor,
                }}
              >
                {topic}
              </div>
              <div
                style={{
                  width: 56,
                  height: 2,
                  backgroundColor: `${scene.accentColor}88`,
                }}
              />
              <div
                style={{
                  fontSize: 16,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: `${chromeColor}cc`,
                }}
              >
                {eyebrow}
              </div>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: titleFontSize,
                lineHeight: 1.05,
                fontWeight: 700,
              }}
            >
              {scene.title}
            </h1>
            <p
              style={{
                marginTop: 22,
                marginBottom: 0,
                fontSize: 24,
                lineHeight: 1.45,
                color: bodyColor,
                opacity: bodyOpacity,
              }}
            >
              {scene.body}
            </p>
          </div>
          <ProgressBar accentColor={scene.accentColor} />
        </div>

        {scene.bullets.length > 0 ? (
          <BulletRail
            accentColor={scene.accentColor}
            bullets={scene.bullets}
            durationInFrames={scene.durationInFrames}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
