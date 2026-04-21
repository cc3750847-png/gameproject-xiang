export type GuidancePhase = 'seeking' | 'aligning' | 'locked' | 'lost';

export type GuidanceDirection = 'left' | 'right' | 'center';

export type GuidanceInput = {
  currentBearing: number;
  targetBearing: number;
  lastUpdateAt: number;
  now: number;
};

export type GuidanceStateResult = {
  phase: GuidancePhase;
  direction: GuidanceDirection;
  deviation: number;
};

export type ParticleDescriptor = {
  id: string;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  delayMs: number;
  durationMs: number;
  scale: number;
  intensity: number;
};
