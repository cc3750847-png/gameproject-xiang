import { describe, expect, it } from 'vitest';
import { getNextScreen } from './getNextScreen';

describe('getNextScreen', () => {
  it('moves from entry to guiding on primary action', () => {
    expect(getNextScreen('entry', 'primary')).toBe('guiding');
  });

  it('moves from resonance to completion on complete action', () => {
    expect(getNextScreen('resonance', 'complete')).toBe('completion');
  });
});
