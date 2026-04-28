import { describe, expect, it } from 'vitest';
import {
  createDefaultPlayerState,
  deserializePlayerState,
  serializePlayerState,
  updatePlayerAvatar,
  updatePlayerNickname,
} from './playerState';
import type { PlayerState } from './types';

describe('playerState', () => {
  it('creates a default local player profile', () => {
    expect(createDefaultPlayerState()).toMatchObject({
      playerId: 'local-player',
      nickname: '湘江旅人',
      title: '初到橘洲',
      avatarDataUrl: null,
      completedNodeIds: [],
      skippedNodeIds: [],
      postcardIds: [],
      achievementIds: [],
    });
  });

  it('trims nickname edits and keeps the previous nickname when empty', () => {
    const player = createDefaultPlayerState();

    expect(updatePlayerNickname(player, '  橘洲探路者  ').nickname).toBe('橘洲探路者');
    expect(updatePlayerNickname(player, '   ').nickname).toBe('湘江旅人');
  });

  it('stores local avatar data URLs and can reset them', () => {
    const player = createDefaultPlayerState();
    const withAvatar = updatePlayerAvatar(player, 'data:image/png;base64,avatar');

    expect(withAvatar.avatarDataUrl).toBe('data:image/png;base64,avatar');
    expect(updatePlayerAvatar(withAvatar, null).avatarDataUrl).toBeNull();
  });

  it('serializes and deserializes player progress safely', () => {
    const player: PlayerState = {
      ...createDefaultPlayerState(),
      nickname: '江风玩家',
      avatarDataUrl: 'data:image/jpeg;base64,avatar',
      completedNodeIds: ['shore-gate'],
      postcardIds: ['shore-postcard'],
      achievementIds: ['first-postcard'],
    };

    expect(deserializePlayerState(serializePlayerState(player))).toEqual(player);
    expect(deserializePlayerState('not-json')).toEqual(createDefaultPlayerState());
  });
});
