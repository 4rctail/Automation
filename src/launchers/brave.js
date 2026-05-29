import { launchChromiumFamily } from './local-chromium.js';

export function defaultBravePath(platform = process.platform) {
  if (platform === 'win32') return 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  if (platform === 'darwin') return '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
  return 'brave-browser';
}

export function launchBrave({ port = 9223, executablePath = defaultBravePath(), userDataDir, extraArgs = [] } = {}) {
  return launchChromiumFamily({ executablePath, port, userDataDir, extraArgs });
}
