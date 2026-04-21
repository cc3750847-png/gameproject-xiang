import { describe, expect, it } from 'vitest';
import { getHoldState } from './getHoldState';

describe('getHoldState', () => {
  it('returns zero progress when hold time is zero', () => {
    expect(getHoldState(0, 1500)).toEqual({ done: false, progress: 0 });
  });

  it('caps progress at one and marks the hold as complete', () => {
    expect(getHoldState(1800, 1500)).toEqual({ done: true, progress: 1 });
  });
});
