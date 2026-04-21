import { describe, expect, it } from 'vitest';
import { deriveGuidanceState } from './deriveGuidanceState';

describe('deriveGuidanceState', () => {
  it('returns a left-seeking state when the target is clearly left of the viewer', () => {
    expect(
      deriveGuidanceState({
        currentBearing: 40,
        targetBearing: 10,
        lastUpdateAt: 1000,
        now: 1000,
      })
    ).toMatchObject({
      phase: 'seeking',
      direction: 'left',
    });
  });

  it('returns a locked state when the target is within the lock threshold', () => {
    expect(
      deriveGuidanceState({
        currentBearing: 10,
        targetBearing: 12,
        lastUpdateAt: 1000,
        now: 1000,
      })
    ).toMatchObject({
      phase: 'locked',
      direction: 'center',
    });
  });
});
