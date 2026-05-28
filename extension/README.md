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
4. Confirm the detected-elements list includes the campaign buttons, Ad Name input, Objective dropdown, GMV text, checkbox/toggle, link, dialog-like section, and the dynamic button that appears after 2 seconds.

## Open / toggle the panel
- Click the **pinned AI Browser Operator extension icon** in the browser toolbar to always show the panel.
- Or use keyboard shortcut:
  - Windows/Linux: `Ctrl+Shift+Y`
  - macOS: `Command+Shift+Y`
- If shortcut conflicts with another extension, change it in `chrome://extensions/shortcuts` (or `edge://extensions/shortcuts`).

## Text file export/import
- **Save BrowserSelect.txt**: exports currently detected elements in a readable pipe-delimited format.
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
- Content script with:
  - DOM scanner with MutationObserver
  - Prompt parser
  - Async action engine with retries
  - Overlay UI for logs, diagnostics, detected elements, and command input
  - Optional live BrowserSelect sync to a local Node file server
- Selector priority:
  - `data-testid`
  - `aria-label`
  - `role`
  - visible text
  - stable attributes

## Troubleshooting
- Reload the unpacked extension in `chrome://extensions` after changing files.
- Pin the extension icon, then click it to show the overlay on the active page.
- Test on the localhost demo page before testing larger apps.
- Inspect the extension service worker from `chrome://extensions` to review background logs and errors.
- Use the overlay **Diagnostics** button to inspect the last URL, last action, last error, injection time, and show/toggle times reported by the service worker.
- Confirm `node extension/tools/browser-file-server.js` is running before enabling live sync or fetching remote instructions.

## Notes
- Classname-only selectors are intentionally avoided.
- Coordinate-based clicking is not used.
- Destructive-looking actions require explicit `confirm()`.
- Automation is restricted to allowed domains in both manifest and runtime guard.
