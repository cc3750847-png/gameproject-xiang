import type { PlayerState } from './types';

export const PLAYER_STORAGE_KEY = 'xiang-river-player';

export function createDefaultPlayerState(): PlayerState {
  return {
    playerId: 'local-player',
    nickname: '湘江旅人',
    title: '初到橘洲',
    avatarDataUrl: null,
    level: 1,
    completedNodeIds: [],
    skippedNodeIds: [],
    postcardIds: [],
    achievementIds: [],
  };
}

export function updatePlayerNickname(player: PlayerState, nickname: string): PlayerState {
  const trimmed = nickname.trim();

  return {
    ...player,
    nickname: trimmed || player.nickname,
  };
}

export function updatePlayerAvatar(player: PlayerState, avatarDataUrl: string | null): PlayerState {
  return {
    ...player,
    avatarDataUrl,
  };
}

export function serializePlayerState(player: PlayerState) {
  return JSON.stringify(player);
}

export function deserializePlayerState(serialized: string | null | undefined): PlayerState {
  if (!serialized) {
    return createDefaultPlayerState();
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<PlayerState>;

    return {
      ...createDefaultPlayerState(),
      ...parsed,
      completedNodeIds: parsed.completedNodeIds ?? [],
      skippedNodeIds: parsed.skippedNodeIds ?? [],
      postcardIds: parsed.postcardIds ?? [],
      achievementIds: parsed.achievementIds ?? [],
    };
  } catch {
    return createDefaultPlayerState();
  }
}
