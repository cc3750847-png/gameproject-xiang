export type PlayerAchievementId =
  | 'first-node'
  | 'first-postcard'
  | 'river-scene-collector'
  | 'xiang-river-route'
  | 'first-skip'
  | 'map-awakened';

export type PlayerState = {
  playerId: string;
  nickname: string;
  title: string;
  avatarDataUrl: string | null;
  level: number;
  completedNodeIds: string[];
  skippedNodeIds: string[];
  postcardIds: string[];
  achievementIds: PlayerAchievementId[];
};

export type AchievementEvent =
  | { type: 'map-refreshed' }
  | { type: 'node-entered'; nodeId: string }
  | { type: 'node-skipped'; nodeId: string }
  | { type: 'photo-task-completed'; nodeId: string }
  | { type: 'postcard-earned'; nodeId: string; postcardId: string }
  | { type: 'journey-completed' };
