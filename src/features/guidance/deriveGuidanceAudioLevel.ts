import type { GuidanceStateResult } from './types';

const MAX_DEVIATION = 45;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function deriveGuidanceAudioLevel(state: GuidanceStateResult) {
  if (state.phase === 'lost') {
    return 0;
  }

  if (state.phase === 'locked') {
    return 1;
  }

  const closeness = 1 - clamp(Math.abs(state.deviation), 0, MAX_DEVIATION) / MAX_DEVIATION;

  if (state.phase === 'aligning') {
    return Number((0.56 + closeness * 0.24).toFixed(2));
  }

  return Number((0.18 + closeness * 0.48).toFixed(2));
}
