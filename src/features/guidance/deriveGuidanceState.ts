import type { GuidanceInput, GuidanceStateResult } from './types';

const STALE_AFTER_MS = 1600;
const LOCK_THRESHOLD = 6;
const ALIGN_THRESHOLD = 18;

function normalizeSignedAngle(angle: number) {
  return ((angle + 540) % 360) - 180;
}

export function deriveGuidanceState(input: GuidanceInput): GuidanceStateResult {
  const deviation = normalizeSignedAngle(input.targetBearing - input.currentBearing);

  if (input.now - input.lastUpdateAt > STALE_AFTER_MS) {
    return {
      phase: 'lost',
      direction: 'center',
      deviation,
    };
  }

  if (Math.abs(deviation) <= LOCK_THRESHOLD) {
    return {
      phase: 'locked',
      direction: 'center',
      deviation,
    };
  }

  if (Math.abs(deviation) <= ALIGN_THRESHOLD) {
    return {
      phase: 'aligning',
      direction: deviation < 0 ? 'left' : 'right',
      deviation,
    };
  }

  return {
    phase: 'seeking',
    direction: deviation < 0 ? 'left' : 'right',
    deviation,
  };
}
