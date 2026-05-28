# AI Browser Operator Plan

## Current state

AI Browser Operator is currently a Chromium extension that runs on allowed webpages. It can scan the page, show an overlay, list visible controls, run simple instructions, and optionally sync text files through a local `localhost` file server.

Today it can:

- Detect common page controls such as buttons, links, inputs, dropdowns, and toggles.
- Show the PC → Browser → Tabs → Current Page Details tree in the page overlay.
- Run simple commands such as `Click Create`, `Find Ad Name field and enter Summer Campaign`, and `Wait for GMV`.
- Save `BrowserSelect.txt` and `BrowserInstruction.txt` locally through browser downloads.
- Use `http://localhost:8787` for optional live file sync during local testing.

## Goal 1: DevTools support

The extension should support DevTools through a real Chrome DevTools extension entry point. The goal is not to scrape Chrome's built-in DevTools interface. Instead, the extension should create its own DevTools panel and use supported APIs.

Planned capabilities:

- Add `devtools_page` to the extension manifest.
- Create a custom **AI Operator** panel inside DevTools.
- Use `chrome.devtools.inspectedWindow` to evaluate safe diagnostics in the inspected page.
- Use `chrome.devtools.network` to collect network request metadata while DevTools is open.
- Let the DevTools panel show inspected page information, console/network-style diagnostics, and future automation context.
- Keep the existing webpage overlay separate from the DevTools panel.

Important limitation:

- Chrome extensions cannot freely view, scrape, or control the built-in Console, Network, Sources, or Elements panels as if they were normal webpages. A DevTools extension can create its own panel and collect information through supported DevTools APIs.

## Goal 2: Remote internet system

The current local file sync is only for one computer. To support other PCs over the internet, the extension should connect outward to a secure central server.

Recommended shape:

```text
Extension on PC 1 ┐
Extension on PC 2 ├─ HTTPS API ─ Admin/System
Extension on PC 3 ┘
```

The extension should send page state and receive queued instructions. Each PC should never expose a public server directly to the internet.

Future API examples:

- `POST /api/devices/register`
- `POST /api/devices/{deviceId}/heartbeat`
- `POST /api/devices/{deviceId}/page-state`
- `GET /api/devices/{deviceId}/instructions`
- `POST /api/devices/{deviceId}/instruction-result`
- `POST /api/devices/{deviceId}/devtools-events`

## Access control

Each installed extension/device should be registered with the server before it can receive instructions.

Access control should include:

- A device ID.
- A login session, API key, or signed token.
- Server-side device enable/disable controls.
- A revoke action that immediately stops a device from receiving instructions.
- Activity logs showing what commands were sent and what results came back.

If access is cut off, the extension should still load locally, but it should stop polling for commands and show a disconnected or disabled status.

## Security rules

Remote automation is powerful because it can click buttons and type into websites. The system should be built carefully.

Rules:

- Use HTTPS only for the remote server.
- Do not expose each user's PC directly to the internet.
- Keep the extension visibly active when connected to a remote system.
- Log command delivery, execution status, and errors.
- Add an emergency disable option in the server and extension.
- Require explicit confirmation for destructive-looking actions.
- Limit host permissions to known, intended domains.
- Store tokens carefully and rotate/revoke them when needed.

## Suggested build order

1. Add the DevTools extension structure.
2. Build a simple custom DevTools panel.
3. Capture inspected page URL, page title, user agent, and network request metadata.
4. Connect DevTools data to the existing background service worker if shared state is needed.
5. Keep improving the normal page overlay and command engine.
6. Replace `localhost` file sync with a secure remote HTTPS API.
7. Add device registration, authentication, access revocation, and audit logs.
8. Add an admin dashboard or backend system after the extension-side flow is stable.

## Near-term milestone

The next practical milestone is a DevTools panel that can be opened from Chrome DevTools and can display:

- Inspected page URL.
- Inspected page title.
- User agent.
- Recent network requests captured while DevTools is open.
- Clear explanation of what DevTools data is available and what is not.
