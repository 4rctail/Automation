/**
 * AdsPower exposes a local HTTP API that starts a profile and returns a CDP
 * websocket endpoint. The exact shape can vary by AdsPower version, so this
 * helper accepts the common ws.puppeteer value and falls back to debugger URLs.
 */
export async function startAdsPowerProfile({ userId, apiBase = 'http://local.adspower.net:50325', openTabs = 1, launchArgs = [] }) {
  if (!userId) throw new Error('AdsPower userId is required');

  const url = new URL('/api/v1/browser/start', apiBase);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('open_tabs', String(openTabs));
  if (launchArgs.length) {
    url.searchParams.set('launch_args', JSON.stringify(launchArgs));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AdsPower start failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const endpoint = payload?.data?.ws?.puppeteer
    ?? payload?.data?.ws?.playwright
    ?? payload?.data?.debugger_address
    ?? payload?.data?.http
    ?? payload?.data?.ws;

  if (!endpoint) {
    throw new Error(`AdsPower response did not include a debugger endpoint: ${JSON.stringify(payload)}`);
  }

  return { endpoint: normalizeAdsPowerEndpoint(endpoint), payload };
}

function normalizeAdsPowerEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return endpoint;
  if (endpoint.startsWith('ws://') || endpoint.startsWith('wss://') || endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `http://${endpoint}`;
}
