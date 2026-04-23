import { createDefaultPlayerState } from './playerState';
import type { AchievementEvent, PlayerAchievementId, PlayerState } from './types';

export const ACHIEVEMENT_DEFINITIONS: Array<{ id: PlayerAchievementId; title: string; kind: 'game' | 'culture' }> = [
  { id: 'map-awakened', title: '地图已点亮', kind: 'game' },
  { id: 'first-node', title: '初访节点', kind: 'game' },
  { id: 'first-skip', title: '自由旅人', kind: 'game' },
  { id: 'first-postcard', title: '第一张明信片', kind: 'game' },
  { id: 'river-scene-collector', title: '江景采集者', kind: 'culture' },
  { id: 'xiang-river-route', title: '湘江回声路线', kind: 'culture' },
];

function unlock(player: PlayerState, achievementId: PlayerAchievementId): PlayerState {
  if (player.achievementIds.includes(achievementId)) {
    return player;
  }

  return {
    ...player,
    achievementIds: [...player.achievementIds, achievementId],
  };
}

export function applyAchievementEvent(player: PlayerState, event: AchievementEvent): PlayerState {
  let next = { ...createDefaultPlayerState(), ...player };

  if (event.type === 'map-refreshed') {
    next = unlock(next, 'map-awakened');
  }

  if (event.type === 'node-entered') {
    next = unlock(next, 'first-node');
  }

  if (event.type === 'node-skipped') {
    next = {
      ...unlock(next, 'first-skip'),
      skippedNodeIds: next.skippedNodeIds.includes(event.nodeId)
        ? next.skippedNodeIds
        : [...next.skippedNodeIds, event.nodeId],
    };
  }

  if (event.type === 'photo-task-completed') {
    next = {
      ...unlock(next, 'river-scene-collector'),
      completedNodeIds: next.completedNodeIds.includes(event.nodeId)
        ? next.completedNodeIds
        : [...next.completedNodeIds, event.nodeId],
    };
  }

  if (event.type === 'postcard-earned') {
    next = unlock(next, 'first-postcard');
    next = {
      ...next,
      postcardIds: next.postcardIds.includes(event.postcardId)
        ? next.postcardIds
        : [...next.postcardIds, event.postcardId],
      completedNodeIds: next.completedNodeIds.includes(event.nodeId)
        ? next.completedNodeIds
        : [...next.completedNodeIds, event.nodeId],
    };
  }

  if (event.type === 'journey-completed') {
    next = unlock(next, 'xiang-river-route');
  }

  return next;
}

export function getAchievementProgress(player: PlayerState) {
  return {
    unlocked: player.achievementIds.length,
    total: ACHIEVEMENT_DEFINITIONS.length,
  };
}
