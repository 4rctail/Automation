import http from 'node:http';
import { CDPConnectionManager } from './cdp-connection-manager.js';
import { createApiServer, attachWebSocketServer } from './server/api.js';

const port = Number(process.env.PORT ?? 3000);
const manager = new CDPConnectionManager();
const app = createApiServer(manager);
const server = http.createServer(app);
attachWebSocketServer(server, manager);

server.listen(port, () => {
  console.log(`Browser orchestration controller listening on http://127.0.0.1:${port}`);
  console.log(`WebSocket command server listening on ws://127.0.0.1:${port}/ws`);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down controller`);
  server.close(() => process.exit(0));
}
