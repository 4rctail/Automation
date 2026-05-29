import os from 'node:os';
import path from 'node:path';
import { launchDetached } from '../utils.js';

export function buildRemoteDebuggingArgs({ port, userDataDir, extraArgs = [] }) {
  if (!port) throw new Error('A remote debugging port is required');
  return [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir ?? defaultUserDataDir(port)}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...extraArgs
  ];
}

export function launchChromiumFamily({ executablePath, port, userDataDir, extraArgs = [] }) {
  const args = buildRemoteDebuggingArgs({ port, userDataDir, extraArgs });
  const pid = launchDetached(executablePath, args);
  return { pid, endpoint: `http://127.0.0.1:${port}`, command: [executablePath, ...args].join(' ') };
}

function defaultUserDataDir(port) {
  return path.join(os.tmpdir(), `browser-orchestration-cdp-${port}`);
}
