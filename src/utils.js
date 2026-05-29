import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

export function makeId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

export function serializeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack
  };
}

export function normalizeEndpoint(endpoint) {
  if (!endpoint) {
    throw new Error('A CDP endpoint is required. Use http://127.0.0.1:<port> or ws://.../devtools/browser/...');
  }

  return endpoint.startsWith('http://') || endpoint.startsWith('https://') || endpoint.startsWith('ws://') || endpoint.startsWith('wss://')
    ? endpoint
    : `http://${endpoint}`;
}

export function launchDetached(command, args, options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    ...options
  });
  child.unref();
  return child.pid;
}

export async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForExit(child) {
  const [code, signal] = await once(child, 'exit');
  return { code, signal };
}
