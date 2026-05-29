import express from 'express';
import { WebSocketServer } from 'ws';
import { serializeError } from '../utils.js';

export function createApiServer(manager) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/browsers', (_req, res) => res.json(manager.listBrowsers()));
  app.post('/browsers', asyncHandler(async (req, res) => res.status(201).json(await manager.registerBrowser(req.body))));
  app.delete('/browsers/:browserId', asyncHandler(async (req, res) => res.json(await manager.unregisterBrowser(req.params.browserId))));
  app.post('/browsers/:browserId/reconnect', asyncHandler(async (req, res) => {
    res.json(await manager.reconnectBrowser(req.params.browserId));
  }));
  app.post('/browsers/:browserId/discover', asyncHandler(async (req, res) => res.json(await manager.discoverTabs(req.params.browserId))));
  app.get('/tabs', asyncHandler(async (_req, res) => res.json(await manager.listTabs())));
  app.get('/browsers/:browserId/tabs/:tabId', asyncHandler(async (req, res) => {
    res.json(await manager.describeTab(req.params.browserId, req.params.tabId));
  }));
  app.post('/browsers/:browserId/tabs/:tabId/commands', asyncHandler(async (req, res) => {
    const result = await manager.execute(req.params.browserId, req.params.tabId, req.body);
    res.json({ ok: true, result });
  }));
  app.get('/browsers/:browserId/console', (req, res) => {
    res.json(manager.getConsoleEntries(req.params.browserId, { tabId: req.query.tabId, limit: Number(req.query.limit ?? 100) }));
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({ ok: false, error: serializeError(error) });
  });

  return app;
}

export function attachWebSocketServer(server, manager) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const sockets = new Set();

  function broadcast(event, payload) {
    const message = JSON.stringify({ event, payload });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  }

  for (const eventName of ['connected', 'disconnected', 'tabsChanged', 'console', 'pageCrashed', 'reconnectFailed']) {
    manager.on(eventName, (payload) => broadcast(eventName, payload));
  }

  wss.on('connection', (socket) => {
    sockets.add(socket);
    socket.send(JSON.stringify({ event: 'hello', payload: { browsers: manager.listBrowsers() } }));

    socket.on('message', async (raw) => {
      let request;
      try {
        request = JSON.parse(raw.toString());
        const result = await handleWsCommand(manager, request);
        socket.send(JSON.stringify({ id: request.id, ok: true, result }));
      } catch (error) {
        socket.send(JSON.stringify({ id: request?.id, ok: false, error: serializeError(error) }));
      }
    });

    socket.on('close', () => sockets.delete(socket));
  });

  return wss;
}

async function handleWsCommand(manager, request) {
  switch (request.command) {
    case 'registerBrowser':
      return manager.registerBrowser(request.payload);
    case 'listBrowsers':
      return manager.listBrowsers();
    case 'discoverTabs':
      return manager.discoverTabs(request.payload?.browserId);
    case 'listTabs':
      return manager.listTabs();
    case 'execute':
      return manager.execute(request.payload.browserId, request.payload.tabId, request.payload.command);
    case 'consoleEntries':
      return manager.getConsoleEntries(request.payload.browserId, request.payload);
    default:
      throw new Error(`Unknown WebSocket command: ${request.command}`);
  }
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
