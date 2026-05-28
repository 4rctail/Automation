# AI Browser Operator (Chromium Extension)

## Local run
1. Clone repository.
2. Open Chromium/Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `extension/` folder.
5. If testing local files, enable **Allow access to file URLs** on the extension details page.
6. Navigate to an allowed domain (TikTok URLs) or open a local `file://` HTML page.
7. Use the floating panel to inspect detected elements and run prompts.

## Open / toggle the panel
- Click the **pinned AI Browser Operator extension icon** in the browser toolbar.
- Or use keyboard shortcut:
  - Windows/Linux: `Ctrl+Shift+Y`
  - macOS: `Command+Shift+Y`
- If shortcut conflicts with another extension, change it in `chrome://extensions/shortcuts` (or `edge://extensions/shortcuts`).

## Text file export/import
- **Save BrowserSelect.txt**: exports currently detected elements in a readable pipe-delimited format.
- **Save BrowserInstruction.txt**: exports instruction text with metadata header.
- **Load instruction file**: choose a `.txt` file; lines beginning with `#` are ignored (excluded from parsing), remaining lines are loaded into prompt box.

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
  - Overlay UI for logs and command input
- Selector priority:
  - `data-testid`
  - `aria-label`
  - `role`
  - visible text
  - stable attributes

## Notes
- Classname-only selectors are intentionally avoided.
- Coordinate-based clicking is not used.
- Destructive-looking actions require explicit `confirm()`.
- Automation is restricted to allowed domains in both manifest and runtime guard.
