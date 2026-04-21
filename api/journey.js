import { JOURNEY_API_PAYLOAD } from '../server/app.js';

function applyHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
}

export default async function handler(request, response) {
  applyHeaders(response);

  if (request?.method && request.method !== 'GET') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  response.status(200).json(JOURNEY_API_PAYLOAD);
}
