import { describe, expect, it, vi } from 'vitest';
import healthHandler from './health.js';
import journeyHandler from './journey.js';
import gameConfigHandler from './games/[gameId]/config.js';
import gameProgressHandler from './games/[gameId]/progress.js';
import gameResultHandler from './games/[gameId]/result.js';

function createResponse() {
  return {
    json: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    statusCode: 200,
  };
}

describe('Vercel API routes', () => {
  it('returns health payload from /api/health', async () => {
    const response = createResponse();

    await healthHandler({}, response);

    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'xiang-river-api',
        status: 'ok',
      })
    );
  });

  it('returns the journey payload from /api/journey', async () => {
    const response = createResponse();

    await journeyHandler({}, response);

    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'xiang-river-mobile-web',
        focus: 'mobile-web-first prototype',
        stages: expect.arrayContaining(['entry', 'guiding', 'finale']),
      })
    );
  });

  it('returns a unified game config payload from the Vercel route', async () => {
    const response = createResponse();

    await gameConfigHandler(
      {
        method: 'GET',
        query: {
          gameId: 'river-sound',
        },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        gameId: 'river-sound',
        stageId: 'guiding',
      })
    );
  });

  it('accepts a unified game progress payload from the Vercel route', async () => {
    const response = createResponse();

    await gameProgressHandler(
      {
        method: 'POST',
        query: {
          gameId: 'island-light',
        },
        body: {
          playerId: 'player-demo',
          sessionId: 'session-303',
          stageId: 'approaching',
          progress: {
            checkpoint: 'light-gate',
            score: 66,
            completionRate: 0.4,
          },
        },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        gameId: 'island-light',
        stageId: 'approaching',
        data: expect.objectContaining({
          accepted: true,
          sessionId: 'session-303',
        }),
      })
    );
  });

  it('returns a unified game result payload from the Vercel route', async () => {
    const response = createResponse();

    await gameResultHandler(
      {
        method: 'POST',
        query: {
          gameId: 'memory-resonance',
        },
        body: {
          playerId: 'player-demo',
          sessionId: 'session-404',
          stageId: 'resonance',
          result: {
            score: 95,
            durationMs: 32000,
            completedObjectives: ['hold-tone'],
          },
        },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        gameId: 'memory-resonance',
        stageId: 'resonance',
        data: expect.objectContaining({
          passed: true,
          nextStageUnlocked: 'completion',
        }),
      })
    );
  });
});
