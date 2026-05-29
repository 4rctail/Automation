const controller = process.env.CONTROLLER_URL ?? 'http://127.0.0.1:3000';

async function api(path, options = {}) {
  const response = await fetch(`${controller}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options
  });
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body;
}

await api('/browsers', {
  method: 'POST',
  body: JSON.stringify({ browserId: 'edge-local', type: 'edge', endpoint: 'http://127.0.0.1:9222' })
});
await api('/browsers', {
  method: 'POST',
  body: JSON.stringify({ browserId: 'brave-local', type: 'brave', endpoint: 'http://127.0.0.1:9223' })
});

const tabs = await api('/tabs');
console.log('All tabs:', tabs);

if (tabs[0]) {
  const result = await api(`/browsers/${tabs[0].browserId}/tabs/${tabs[0].tabId}/commands`, {
    method: 'POST',
    body: JSON.stringify({ action: 'getTitle' })
  });
  console.log('First tab title:', result);
}
