import { describe, expect, it } from 'vitest';
import { applyAchievementEvent, getAchievementProgress } from './achievements';
import { createDefaultPlayerState } from './playerState';

describe('achievements', () => {
  it('unlocks game achievements for terminal-visible milestones', () => {
    const player = createDefaultPlayerState();
    const afterNode = applyAchievementEvent(player, { type: 'node-entered', nodeId: 'shore-gate' });
    const afterPostcard = applyAchievementEvent(afterNode, {
      type: 'postcard-earned',
      nodeId: 'shore-gate',
      postcardId: 'shore-postcard',
    });

    expect(afterPostcard.achievementIds).toContain('first-node');
    expect(afterPostcard.achievementIds).toContain('first-postcard');
  });

  it('unlocks cultural achievements from node and route records', () => {
    const player = createDefaultPlayerState();
    const afterPhotos = applyAchievementEvent(player, {
      type: 'photo-task-completed',
      nodeId: 'shore-gate',
    });
    const afterFinale = applyAchievementEvent(afterPhotos, { type: 'journey-completed' });

    expect(afterFinale.achievementIds).toContain('river-scene-collector');
    expect(afterFinale.achievementIds).toContain('xiang-river-route');
  });

  it('deduplicates achievement unlocks and reports collection progress', () => {
    const player = applyAchievementEvent(createDefaultPlayerState(), {
      type: 'node-entered',
      nodeId: 'shore-gate',
    });
    const repeated = applyAchievementEvent(player, {
      type: 'node-entered',
      nodeId: 'shore-gate',
    });

    expect(repeated.achievementIds.filter((id) => id === 'first-node')).toHaveLength(1);
    expect(getAchievementProgress(repeated)).toMatchObject({
      unlocked: 1,
      total: 6,
    });
  });
});
