# Browser Orchestration over Playwright CDP

A small production-usable controller for orchestrating already-open Chromium-based browsers, including Microsoft Edge, Brave, and AdsPower profiles. It uses Node.js, Playwright, Chrome DevTools Protocol (CDP), Express, and `ws`.

The system **does not use browser extensions**, **does not inject extension scripts**, and **does not require manual DevTools interaction**. Browser control happens through `chromium.connectOverCDP()` and per-page CDP sessions.

## Architecture

```text
src/
  browser-worker.js              # One CDP-connected browser and its tabs
  cdp-connection-manager.js      # Central browser registry and command routing
  command-queue.js               # Per-tab FIFO command queues
  index.js                       # HTTP + WebSocket controller entrypoint
  launchers/
    adspower.js                  # AdsPower local API profile startup helper
    brave.js                     # Brave --remote-debugging-port launcher
    edge.js                      # Edge --remote-debugging-port launcher
    local-chromium.js            # Shared Chromium-family launch helper
  server/
    api.js                       # Express REST API and ws command server
examples/
  launch-edge.js
  launch-brave.js
  start-adspower-profile.js
  multi-browser-client.js
```

## Install

```bash
npm install
npm start
```

The controller listens on:

- REST: `http://127.0.0.1:3000`
- WebSocket: `ws://127.0.0.1:3000/ws`

## Launch browser examples

### Microsoft Edge

```bash
npm run example:edge
```

Equivalent manual command:

```bash
microsoft-edge --remote-debugging-port=9222 --user-data-dir=/tmp/edge-cdp-profile --no-first-run --no-default-browser-check
```

### Brave

```bash
npm run example:brave
```

Equivalent manual command:

```bash
brave-browser --remote-debugging-port=9223 --user-data-dir=/tmp/brave-cdp-profile --no-first-run --no-default-browser-check
```

### AdsPower

Start a profile through the AdsPower local API and return the debugger endpoint dynamically:

```bash
ADSPOWER_USER_ID=your_profile_id npm run example:adspower
```

The helper calls `http://local.adspower.net:50325/api/v1/browser/start`, reads the returned debugger endpoint, and prints a registration command.

## Register browsers dynamically

```bash
curl -X POST http://127.0.0.1:3000/browsers \
  -H 'content-type: application/json' \
  -d '{"browserId":"edge-local","type":"edge","endpoint":"http://127.0.0.1:9222"}'

curl -X POST http://127.0.0.1:3000/browsers \
  -H 'content-type: application/json' \
  -d '{"browserId":"brave-local","type":"brave","endpoint":"http://127.0.0.1:9223"}'
```

The controller can maintain many simultaneous browser workers. Each worker connects with Playwright `chromium.connectOverCDP()` and registers current contexts and pages.

## Enumerate all tabs

```bash
curl http://127.0.0.1:3000/tabs
```

Refresh discovery for one browser:

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/discover
```

## Execute commands on a specific tab

All commands are queued per `{browserId, tabId}` so operations on one tab stay ordered while other tabs can run concurrently.

### Get title

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"getTitle"}'
```

### Runtime.evaluate / console-like JavaScript

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"console","params":{"expression":"document.title"}}'
```

### Inject JavaScript

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"injectJs","params":{"source":"(() => { window.demoValue = 123; return window.demoValue; })()"}}'
```

### Modify DOM

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"modifyDom","params":{"script":"document.body.style.outline = '\''4px solid magenta'\''; return true;"}}'
```

### Click elements

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"click","params":{"selector":"button[type=submit]","timeoutMs":5000}}'
```

### Retrieve localStorage

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"localStorage"}'
```

### Execute fetch()

```bash
curl -X POST http://127.0.0.1:3000/browsers/edge-local/tabs/TAB_ID/commands \
  -H 'content-type: application/json' \
  -d '{"action":"fetch","params":{"url":"https://example.com/api","options":{"method":"GET"},"responseType":"text"}}'
```

## Console log streaming

The worker subscribes to Playwright `page.on('console')` for every discovered page and broadcasts console entries over WebSocket. Recent entries are also available over REST:

```bash
curl 'http://127.0.0.1:3000/browsers/edge-local/console?tabId=TAB_ID&limit=50'
```

## WebSocket command server

Connect to `ws://127.0.0.1:3000/ws`. Events such as `console`, `tabsChanged`, `connected`, and `disconnected` are pushed to every client.

Example command frame:

```json
{
  "id": "cmd-1",
  "command": "execute",
  "payload": {
    "browserId": "edge-local",
    "tabId": "TAB_ID",
    "command": {
      "action": "console",
      "params": { "expression": "await fetch('/').then(r => r.status)" }
    }
  }
}
```

## Reconnect and stale page handling

- `BrowserWorker` listens for Playwright `browser.on('disconnected')` and retries the configured endpoint until it comes back.
- Closed/crashed pages are removed from the tab registry.
- Commands against stale tabs fail with an explicit error and should be retried after tab discovery.
- Browser registration is dynamic, so workers can be added, removed, and reconnected without restarting the central controller.
