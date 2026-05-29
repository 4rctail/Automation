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


## Final validation
Run these checks after changing the extension code:

```bash
cd extension
npm run verify
```

`npm run verify` performs JavaScript syntax checks, validates `manifest.json`, and runs prompt-parser regression tests for the documented instruction examples. No install step is required for these checks because they use only Node built-ins.

## How to use
1. Load the extension:
   - Open Chrome/Edge and go to `chrome://extensions` or `edge://extensions`.
   - Enable **Developer mode**.
   - Choose **Load unpacked** and select this repository's `extension/` folder.
   - Pin **AI Browser Operator** to the browser toolbar.
2. Open a supported page:
   - Use `http://localhost:8000/test-page.html` from the demo server for first validation.
   - Or use an allowed TikTok page, `localhost`, `127.0.0.1`, or `file://`.
   - For `file://` pages, enable **Allow access to file URLs** on the extension details page.
3. Open the panel:
   - Click the pinned extension icon, or press `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS).
4. Review what the scanner found:
   - Confirm the panel shows **PC**, **Browser**, **Tabs and windows**, and **Current Page Details**.
   - Expand control groups to see buttons, inputs, dropdowns, toggles, links, and visible text.
   - Click **Show Found Overlays** if you want boxes drawn around detected controls.
5. Run an instruction:
   - Enter one or more prompt lines in the text box.
   - Click **Run**.
   - Watch the log for each parsed action and any failures.
6. Export or sync files when needed:
   - Click **Save BrowserSelect.txt** to download the current page/browser hierarchy and selectors.
   - Click **Save BrowserInstruction.txt** to download the current instruction text.
   - Start `node extension/tools/browser-file-server.js` from the repo root and enable **Live sync BrowserSelect** to write the current selection data to `extension/local-data/BrowserSelect.txt`.

## Supported instruction examples
- `Click Create and wait for GMV`
- `Find Ad Name field and enter Summer Campaign`
- `Select GMV in Objective`
- `Choose GMV from Objective`
- `Set Objective to GMV`
- `If Something Went Wrong appears, retry`
- `Scroll down 500`
- Multi-line files are supported; blank lines and lines beginning with `#` are ignored.

## Manual smoke test
1. From the repo root, run:
   ```bash
   cd extension/demo
   python -m http.server 8000
   ```
2. Open `http://localhost:8000/test-page.html`.
3. Open the extension panel.
4. Run `Click Create and wait for GMV`; the action should click the **Create Campaign** button and complete after finding the **GMV** text.
5. Run `Find Ad Name field and enter Summer Campaign`; the **Ad Name** input should receive that value.
6. Run `Select GMV in Objective`; the **Objective** dropdown should switch to **GMV**.
7. Click **Save BrowserSelect.txt** and confirm exported controls include an `exactSelector` column.

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
