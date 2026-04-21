import { createServer as createHttpServer } from 'node:http';
import {
  createGameProgressPayload,
  createGameResultPayload,
  getGameConfigPayload,
  getGameErrorPayload,
} from './gameApi.js';

export const JOURNEY_API_PAYLOAD = {
  project: 'xiang-river-mobile-web',
  focus: 'mobile-web-first prototype',
  stages: [
    'entry',
    'guiding',
    'approaching',
    'resonance',
    'completion',
    'handoff',
    'finale',
  ],
};

export function getHealthPayload() {
  return {
    service: 'xiang-river-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

function json(data) {
  return JSON.stringify(data);
}

function sendJson(response, statusCode, data) {
  response.statusCode = statusCode;
  response.end(json(data));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });

    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

export function createServer() {
  return createHttpServer(async (request, response) => {
    const { method = 'GET', url = '/' } = request;
    const pathname = new URL(url, 'http://127.0.0.1').pathname;
    const gameRoute = pathname.match(/^\/api\/games\/([^/]+)\/(config|progress|result)$/);

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (gameRoute) {
      const [, gameId, action] = gameRoute;

      if (action === 'config') {
        if (method !== 'GET') {
          sendJson(response, 405, getGameErrorPayload('method_not_allowed', 'Use GET for config.'));
          return;
        }

        const payload = getGameConfigPayload(gameId);
        if (!payload) {
          sendJson(response, 404, getGameErrorPayload('game_not_found', gameId));
          return;
        }

        sendJson(response, 200, payload);
        return;
      }

      if (method !== 'POST') {
        sendJson(response, 405, getGameErrorPayload('method_not_allowed', `Use POST for ${action}.`));
        return;
      }

      let body;
      try {
        body = await readJsonBody(request);
      } catch {
        sendJson(response, 400, getGameErrorPayload('invalid_payload', 'Request body must be JSON.'));
        return;
      }

      const payload =
        action === 'progress'
          ? createGameProgressPayload(gameId, body)
          : createGameResultPayload(gameId, body);

      if (!payload) {
        sendJson(response, 404, getGameErrorPayload('game_not_found', gameId));
        return;
      }

      sendJson(response, 200, payload);
      return;
    }

    if (method !== 'GET') {
      sendJson(response, 405, { error: 'method_not_allowed' });
      return;
    }

    if (pathname === '/api/health') {
      sendJson(response, 200, getHealthPayload());
      return;
    }

    if (pathname === '/api/journey') {
      sendJson(response, 200, JOURNEY_API_PAYLOAD);
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  });
}
