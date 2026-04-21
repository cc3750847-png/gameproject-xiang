const API_VERSION = 'v1';
const CONTRACT_UPDATED_AT = '2026-04-20';

export const GAME_LINES = {
  'river-sound': {
    gameId: 'river-sound',
    stageId: 'guiding',
    title: '循音觅路',
    objective: '根据粒子与音量提示定位下一段主线入口。',
    summary: '面向第一段主线节点的方向追踪玩法。',
    targetScore: 60,
    nextStageUnlocked: 'approaching',
    defaultCheckpoint: 'sound-gate-a',
    reward: {
      type: 'memory-fragment',
      id: 'fragment-river-sound',
      amount: 1,
    },
  },
  'island-light': {
    gameId: 'island-light',
    stageId: 'approaching',
    title: '洲光校准',
    objective: '逐步点亮三个光环节点，确认玩家已经抵达目标区域。',
    summary: '面向靠近阶段的节点确认玩法。',
    targetScore: 70,
    nextStageUnlocked: 'resonance',
    defaultCheckpoint: 'lantern-ring-a',
    reward: {
      type: 'light-token',
      id: 'token-island-light',
      amount: 1,
    },
  },
  'memory-resonance': {
    gameId: 'memory-resonance',
    stageId: 'resonance',
    title: '记忆共振',
    objective: '保持节奏与姿态稳定，完成最终共鸣仪式。',
    summary: '面向共鸣阶段的结算玩法。',
    targetScore: 80,
    nextStageUnlocked: 'completion',
    defaultCheckpoint: 'resonance-core',
    reward: {
      type: 'memory-fragment',
      id: 'fragment-memory-resonance',
      amount: 1,
    },
  },
};

function buildMeta() {
  return {
    version: API_VERSION,
    updatedAt: CONTRACT_UPDATED_AT,
    contract: 'stage-game-line',
  };
}

function buildEnvelope(gameLine, data) {
  return {
    success: true,
    gameId: gameLine.gameId,
    stageId: gameLine.stageId,
    data,
    meta: buildMeta(),
  };
}

function buildError(error, details) {
  return {
    success: false,
    error,
    details,
    meta: buildMeta(),
  };
}

export function getGameLine(gameId) {
  return GAME_LINES[gameId] ?? null;
}

export function getGameConfigPayload(gameId) {
  const gameLine = getGameLine(gameId);
  if (!gameLine) {
    return null;
  }

  return buildEnvelope(gameLine, {
    title: gameLine.title,
    objective: gameLine.objective,
    summary: gameLine.summary,
    targetScore: gameLine.targetScore,
    checkpoints: [gameLine.defaultCheckpoint, `${gameLine.defaultCheckpoint}-b`, `${gameLine.defaultCheckpoint}-c`],
    submitEndpoints: {
      progress: `/api/games/${gameLine.gameId}/progress`,
      result: `/api/games/${gameLine.gameId}/result`,
    },
    rewardPreview: [gameLine.reward],
  });
}

export function createGameProgressPayload(gameId, body = {}) {
  const gameLine = getGameLine(gameId);
  if (!gameLine) {
    return null;
  }

  const progress = body.progress ?? {};

  return buildEnvelope(gameLine, {
    accepted: true,
    sessionId: body.sessionId ?? 'session-pending',
    playerId: body.playerId ?? 'player-pending',
    checkpoint: progress.checkpoint ?? gameLine.defaultCheckpoint,
    score: progress.score ?? 0,
    completionRate: progress.completionRate ?? 0,
    nextSuggestedAction: 'continue',
  });
}

export function createGameResultPayload(gameId, body = {}) {
  const gameLine = getGameLine(gameId);
  if (!gameLine) {
    return null;
  }

  const result = body.result ?? {};
  const score = result.score ?? 0;
  const passed = score >= gameLine.targetScore;

  return buildEnvelope(gameLine, {
    accepted: true,
    sessionId: body.sessionId ?? 'session-pending',
    playerId: body.playerId ?? 'player-pending',
    score,
    passed,
    durationMs: result.durationMs ?? 0,
    completedObjectives: result.completedObjectives ?? [],
    nextStageUnlocked: passed ? gameLine.nextStageUnlocked : null,
    rewards: passed ? [gameLine.reward] : [],
  });
}

export function getGameErrorPayload(error, details) {
  return buildError(error, details);
}
