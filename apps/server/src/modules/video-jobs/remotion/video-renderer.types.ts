export type RenderSceneTemplate =
  | 'hook'
  | 'problem'
  | 'mechanism'
  | 'evidence'
  | 'takeaway'
  | 'bullet'
  | 'title';

export type RenderTransition = 'none' | 'fade' | 'slide' | 'wipe';

export type VideoCreativeSummary = {
  topic: string;
  hook: string;
  problem: string;
  method: string;
  result: string;
  takeaway: string;
  source_excerpt_count: number;
};

export type VideoCreativeScenePlan = {
  sceneIndex: number;
  templateType: RenderSceneTemplate;
  title: string;
  body: string;
  bullets: string[];
  narrationText: string;
  transition: RenderTransition;
  accentColor?: string | null;
  emphasisTerms?: string[];
};

export type VideoCreativePlan = {
  topic: string;
  summary: VideoCreativeSummary;
  scenes: VideoCreativeScenePlan[];
};

export type BuiltVideoScene = {
  sceneIndex: number;
  templateType: RenderSceneTemplate;
  title: string;
  body: string;
  bullets: string[];
  accentColor: string;
  narrationText: string;
  transition: RenderTransition;
  durationInFrames: number;
  audioStaticFilePath: string | null;
  audioObjectKey: string | null;
  actualAudioDurationMs: number | null;
};

export type VideoRenderProps = {
  videoJobId: string;
  topic: string;
  renderProfile: '480p' | '720p';
  scenes: Array<{
    sceneIndex: number;
    templateType: RenderSceneTemplate;
    title: string;
    body: string;
    bullets: string[];
    accentColor: string;
    durationInFrames: number;
    audioStaticFilePath: string | null;
    transition: RenderTransition;
  }>;
};

export type BuiltVideoNarrative = {
  topic: string;
  summary: VideoCreativeSummary;
  storyboard: Record<string, unknown>;
  scenesMarkdown: string;
  scenes: BuiltVideoScene[];
};
