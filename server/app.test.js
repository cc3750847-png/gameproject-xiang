import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from './app.js';

const runningServers = [];

afterEach(async () => {
  await Promise.all(
    runningServers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe('createServer', () => {
  it('returns health information from /api/health', async () => {
    const server = createServer();
    runningServers.push(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/health`;

    const response = await fetch(url);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('xiang-river-api');
  });

  it('returns a unified game config for a stage game line', async () => {
    const server = createServer();
    runningServers.push(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/games/river-sound/config`;

    const response = await fetch(url);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        gameId: 'river-sound',
        stageId: 'guiding',
        data: expect.objectContaining({
          title: expect.any(String),
          objective: expect.any(String),
          submitEndpoints: {
            progress: '/api/games/river-sound/progress',
            result: '/api/games/river-sound/result',
          },
        }),
        meta: expect.objectContaining({
          version: 'v1',
        }),
      })
    );
  });

  it('accepts unified game progress submissions', async () => {
    const server = createServer();
    runningServers.push(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/games/island-light/progress`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerId: 'player-demo',
        sessionId: 'session-101',
        stageId: 'approaching',
        progress: {
          checkpoint: 'lantern-ring-b',
          score: 72,
          completionRate: 0.5,
        },
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        gameId: 'island-light',
        stageId: 'approaching',
        data: expect.objectContaining({
          accepted: true,
          sessionId: 'session-101',
          checkpoint: 'lantern-ring-b',
          completionRate: 0.5,
        }),
      })
    );
  });

  it('returns a unified result payload for game completion', async () => {
    const server = createServer();
    runningServers.push(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/games/memory-resonance/result`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerId: 'player-demo',
        sessionId: 'session-202',
        stageId: 'resonance',
        result: {
          score: 96,
          durationMs: 28400,
          completedObjectives: ['hold-tone', 'align-breath'],
        },
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        gameId: 'memory-resonance',
        stageId: 'resonance',
        data: expect.objectContaining({
          accepted: true,
          sessionId: 'session-202',
          passed: true,
          nextStageUnlocked: 'completion',
          rewards: expect.arrayContaining([
            expect.objectContaining({
              type: 'memory-fragment',
            }),
          ]),
        }),
      })
    );
  });
});
