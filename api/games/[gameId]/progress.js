import { createGameProgressPayload, getGameErrorPayload } from '../../../server/gameApi.js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');

  if (request.method !== 'POST') {
    response.status(405).json(getGameErrorPayload('method_not_allowed', 'Use POST for progress.'));
    return;
  }

  const payload = createGameProgressPayload(request.query.gameId, request.body);

  if (!payload) {
    response.status(404).json(getGameErrorPayload('game_not_found', request.query.gameId));
    return;
  }

  response.status(200).json(payload);
}
