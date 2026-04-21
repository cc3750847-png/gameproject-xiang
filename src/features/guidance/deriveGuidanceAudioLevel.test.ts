import { describe, expect, it } from 'vitest';
import { deriveGuidanceAudioLevel } from './deriveGuidanceAudioLevel';

describe('deriveGuidanceAudioLevel', () => {
  it('gets louder as the user approaches the target', () => {
    const seeking = deriveGuidanceAudioLevel({
      phase: 'seeking',
      direction: 'left',
      deviation: -30,
    });
    const aligning = deriveGuidanceAudioLevel({
      phase: 'aligning',
      direction: 'left',
      deviation: -10,
    });
    const locked = deriveGuidanceAudioLevel({
      phase: 'locked',
      direction: 'center',
      deviation: 0,
    });

    expect(seeking).toBeLessThan(aligning);
    expect(aligning).toBeLessThan(locked);
  });

  it('mutes the guidance tone when the signal is lost', () => {
    expect(
      deriveGuidanceAudioLevel({
        phase: 'lost',
        direction: 'center',
        deviation: 0,
      })
    ).toBe(0);
  });
});
