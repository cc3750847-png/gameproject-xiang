import { describe, expect, it } from 'vitest';
import { getPrimaryAction } from './getPrimaryAction';

describe('getPrimaryAction', () => {
  it('returns the CTA copy for the start state', () => {
    expect(getPrimaryAction('start')).toBe('开始寻乐');
  });

  it('returns the CTA copy for the guiding state', () => {
    expect(getPrimaryAction('guiding')).toBe('继续寻乐');
  });
});

