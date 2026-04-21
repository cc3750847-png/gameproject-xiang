import type { GuidanceStateResult, ParticleDescriptor } from './types';

const PHASE_COUNTS = {
  seeking: 18,
  aligning: 14,
  locked: 12,
  lost: 8,
} as const;

function getOriginX(phase: GuidanceStateResult['phase'], direction: GuidanceStateResult['direction'], column: number) {
  if (phase === 'locked') {
    return -42 + column * 28;
  }

  if (phase === 'lost') {
    return -90 + column * 36;
  }

  if (direction === 'left') {
    return -156 + column * 18;
  }

  if (direction === 'right') {
    return 66 + column * 18;
  }

  return -48 + column * 24;
}

function getTargetX(state: GuidanceStateResult, column: number) {
  if (state.phase === 'locked') {
    return -6 + column * 4;
  }

  if (state.phase === 'aligning') {
    return state.direction === 'left' ? -12 + column * 4 : 12 - column * 4;
  }

  if (state.phase === 'seeking') {
    return state.direction === 'left' ? -18 + column * 6 : 18 - column * 6;
  }

  return -24 + column * 12;
}

function getTargetY(phase: GuidanceStateResult['phase'], row: number) {
  if (phase === 'locked') {
    return -16 + row * 16;
  }

  if (phase === 'aligning') {
    return -22 + row * 18;
  }

  if (phase === 'lost') {
    return -44 + row * 28;
  }

  return -28 + row * 18;
}

export function deriveParticleField(state: GuidanceStateResult): ParticleDescriptor[] {
  const count = PHASE_COUNTS[state.phase];
  const columnCount = state.phase === 'locked' ? 4 : state.phase === 'lost' ? 4 : 6;

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;

    return {
      id: `${state.phase}-${state.direction}-${index}`,
      originX: getOriginX(state.phase, state.direction, column),
      originY: -72 + row * 54,
      targetX: getTargetX(state, column),
      targetY: getTargetY(state.phase, row),
      delayMs: index * 90,
      durationMs: state.phase === 'locked' ? 1800 : state.phase === 'aligning' ? 2100 : 2400,
      scale: state.phase === 'locked' ? 1.3 : state.phase === 'aligning' ? 1.1 : 0.95,
      intensity: state.phase === 'lost' ? 0.35 : state.phase === 'locked' ? 1 : 0.78,
    };
  });
}
