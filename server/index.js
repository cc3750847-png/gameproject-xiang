import { createServer } from './app.js';

const port = Number(process.env.PORT || 8787);
const server = createServer();

server.listen(port, '127.0.0.1', () => {
  console.log(`xiang-river-api listening on http://127.0.0.1:${port}`);
});
