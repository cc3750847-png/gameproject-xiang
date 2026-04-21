# Three Game Line APIs

This project exposes one shared contract for the three game-line endpoints. The only route-specific value is `gameId`; the response envelope and `meta` object are the same across config, progress, and result.

## Game IDs

- `river-sound`: guiding stage game
- `island-light`: approaching stage game
- `memory-resonance`: resonance stage game

## Shared Envelope

All successful game-line responses return:

```json
{
  "success": true,
  "gameId": "memory-resonance",
  "stageId": "resonance",
  "data": {},
  "meta": {
    "version": "v1",
    "updatedAt": "2026-04-20",
    "contract": "stage-game-line"
  }
}
```

The `meta` fields are part of the served contract and should be treated as required:

- `version`: contract version, currently `v1`
- `updatedAt`: last contract update date, currently `2026-04-20`
- `contract`: fixed contract name, currently `stage-game-line`

## `GET /api/games/:gameId/config`

Returns the static configuration for a game line.

Response `data` shape:

```json
{
  "title": "寰煶瑙呰矾",
  "objective": "鏍规嵁绮掑瓙涓庨煶閲忔彁绀哄畾浣嶄笅涓€娈典富绾垮叆鍙ｃ€?",
  "summary": "闈㈠悜绗竴娈典富绾胯妭鐐圭殑鏂瑰悜杩借釜鐜╂硶銆?",
  "targetScore": 60,
  "checkpoints": ["sound-gate-a", "sound-gate-a-b", "sound-gate-a-c"],
  "submitEndpoints": {
    "progress": "/api/games/river-sound/progress",
    "result": "/api/games/river-sound/result"
  },
  "rewardPreview": [
    {
      "type": "memory-fragment",
      "id": "fragment-river-sound",
      "amount": 1
    }
  ]
}
```

## `POST /api/games/:gameId/progress`

Accepts in-session progress updates.

Request body:

```json
{
  "playerId": "player-demo",
  "sessionId": "session-101",
  "stageId": "approaching",
  "progress": {
    "checkpoint": "lantern-ring-b",
    "score": 72,
    "completionRate": 0.5
  }
}
```

Response `data` shape:

```json
{
  "accepted": true,
  "sessionId": "session-101",
  "playerId": "player-demo",
  "checkpoint": "lantern-ring-b",
  "score": 72,
  "completionRate": 0.5,
  "nextSuggestedAction": "continue"
}
```

## `POST /api/games/:gameId/result`

Accepts the final result and returns unlock state plus rewards when the score passes the stage threshold.

Request body:

```json
{
  "playerId": "player-demo",
  "sessionId": "session-202",
  "stageId": "resonance",
  "result": {
    "score": 96,
    "durationMs": 28400,
    "completedObjectives": ["hold-tone", "align-breath"]
  }
}
```

Response `data` shape:

```json
{
  "accepted": true,
  "sessionId": "session-202",
  "playerId": "player-demo",
  "score": 96,
  "passed": true,
  "durationMs": 28400,
  "completedObjectives": ["hold-tone", "align-breath"],
  "nextStageUnlocked": "completion",
  "rewards": [
    {
      "type": "memory-fragment",
      "id": "fragment-memory-resonance",
      "amount": 1
    }
  ]
}
```

## Error Contract

Game-line failures return the same envelope shape with `success: false`:

```json
{
  "success": false,
  "error": "game_not_found",
  "details": "unknown-id",
  "meta": {
    "version": "v1",
    "updatedAt": "2026-04-20",
    "contract": "stage-game-line"
  }
}
```

The live game handlers currently use the following error codes:

- `game_not_found`
- `method_not_allowed`
- `invalid_payload`

