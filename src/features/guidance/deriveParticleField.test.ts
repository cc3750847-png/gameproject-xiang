import { describe, expect, it } from 'vitest';
import { deriveParticleField } from './deriveParticleField';

describe('deriveParticleField', () => {
  it('biases particles toward the left edge while seeking left', () => {
    const particles = deriveParticleField({
      phase: 'seeking',
      direction: 'left',
      deviation: -28,
    });

    expect(particles.length).toBeGreaterThan(0);
    expect(particles.every((particle) => particle.originX <= 40)).toBe(true);
  });

  it('converges particles toward the center while locked', () => {
    const particles = deriveParticleField({
      phase: 'locked',
      direction: 'center',
      deviation: 0,
    });

    expect(particles.length).toBeGreaterThan(0);
    expect(particles.every((particle) => Math.abs(particle.targetX) <= 10)).toBe(true);
  });
});
