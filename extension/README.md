# AI Browser Operator (Chromium Extension)

## Local run
1. Clone repository.
2. Open Chromium/Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `extension/` folder.
5. If testing local files, enable **Allow access to file URLs** on the extension details page.
6. Navigate to an allowed domain: TikTok, `file://`, `localhost`, or `127.0.0.1`.
7. Click the pinned AI Browser Operator extension icon or press `Ctrl+Shift+Y` to open the panel.

> Do not open `src/content/overlay.html` directly. It is a partial UI template loaded by the content script inside a supported browser page, so it will not work as a standalone page.

## Demo page
1. Start the demo server:
   ```bash
   cd extension/demo
   python -m http.server 8000
   ```
2. Open `http://localhost:8000/test-page.html`.
3. Click the pinned extension icon or press `Ctrl+Shift+Y`.
4. Confirm the overlay first shows a collapsible **PC** node, then **Browser**, then **Tabs and windows**, then **Current Page Details** with buttons, text, inputs, dropdowns, toggles, links, and the dynamic button that appears after 2 seconds.

## Open / toggle the panel
- Click the **pinned AI Browser Operator extension icon** in the browser toolbar to always show the panel.
- Or use keyboard shortcut:
  - Windows/Linux: `Ctrl+Shift+Y`
  - macOS: `Command+Shift+Y`
- If shortcut conflicts with another extension, change it in `chrome://extensions/shortcuts` (or `edge://extensions/shortcuts`).

## DevTools panel
1. Load or reload the unpacked extension from `chrome://extensions`.
2. Open a supported page.
3. Open Chrome DevTools with `F12` or `Ctrl+Shift+I`.
4. Select the **AI Operator** DevTools tab.
5. Use **Refresh page info** to read the inspected page URL, title, and user agent.
6. Reload or use the page while DevTools is open to see recent network request metadata in the panel.

The DevTools panel uses supported `chrome.devtools` APIs. It creates its own panel; it does not scrape Chrome's built-in Console, Network, Sources, or Elements panel UI.

## Text file export/import
- **Save BrowserSelect.txt**: exports the hierarchy of PC, Browser, Windows/Tabs, current page details, page controls, and visible text in a readable pipe-delimited format.
- **Save BrowserInstruction.txt**: exports instruction text with metadata header.
- **Load instruction file**: choose a `.txt` file; lines beginning with `#` are ignored (excluded from parsing), remaining lines are loaded into prompt box.
- **Fetch BrowserInstruction**: reads instructions from `http://localhost:8787/BrowserInstruction.txt`, ignores comment lines beginning with `#`, and loads the remaining text into the prompt box.

## Local writer / live file sync
1. From the repository root, start the local file server:
   ```bash
   node extension/tools/browser-file-server.js
   ```
2. In the overlay, enable **Live sync BrowserSelect**.
3. Detected elements are POSTed to `http://localhost:8787/BrowserSelect.txt` about once per second after scanner updates.
4. Files are saved at:
   - `extension/local-data/BrowserSelect.txt`
   - `extension/local-data/BrowserInstruction.txt`
5. You can also POST instruction text to `http://localhost:8787/BrowserInstruction.txt`, then click **Fetch BrowserInstruction** in the overlay.

## Example prompts
- `Click Create and wait for GMV`
- `Find Ad Name field and enter Summer Campaign`
- `If Something Went Wrong appears, retry`

## Architecture
- Manifest V3 + background service worker
- DevTools page and custom DevTools panel for inspected page diagnostics and network metadata
- Content script with:
  - DOM scanner with MutationObserver
  - Prompt parser
  - Async action engine with retries
  - Overlay UI for logs, diagnostics, detected elements, PC/browser/tab tree, and command input
  - Optional live BrowserSelect sync to a local Node file server
- The extension requests the Chromium `tabs` permission so the background worker can gather browser window and tab titles/URLs for the PC → Browser → Tabs tree.
- Selector priority:
  - `data-testid`
  - `aria-label`
  - `role`
  - visible text
  - stable attributes

## Troubleshooting
- Reload the unpacked extension in `chrome://extensions` after changing files.
- If the **AI Operator** DevTools tab does not appear, reload the unpacked extension and reopen DevTools.
- Pin the extension icon, then click it to show the overlay on the active page.
- Test on the localhost demo page before testing larger apps.
- Inspect the extension service worker from `chrome://extensions` to review background logs and errors.
- Use **Refresh PC/Browser/Tabs** if the browser/tab tree looks stale after opening or closing tabs.
- Use the overlay **Diagnostics** button to inspect the last URL, last action, last error, injection time, show/toggle times, and browser context reported by the service worker.
- Confirm `node extension/tools/browser-file-server.js` is running before enabling live sync or fetching remote instructions.

## Notes
- Classname-only selectors are intentionally avoided.
- Coordinate-based clicking is not used.
- Destructive-looking actions require explicit `confirm()`.
- Automation is restricted to allowed domains in both manifest and runtime guard.
- DevTools support is limited to official DevTools extension APIs; the extension cannot directly read Chrome's built-in DevTools UI.
