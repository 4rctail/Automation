import { launchChromiumFamily } from './local-chromium.js';

export function defaultEdgePath(platform = process.platform) {
  if (platform === 'win32') return 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (platform === 'darwin') return '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
  return 'microsoft-edge';
}

export function launchEdge({ port = 9222, executablePath = defaultEdgePath(), userDataDir, extraArgs = [] } = {}) {
  return launchChromiumFamily({ executablePath, port, userDataDir, extraArgs });
}
