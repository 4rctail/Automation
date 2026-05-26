# AI Browser Operator (Chromium Extension)

## Local run
1. Clone repository.
2. Open Chromium/Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `extension/` folder.
5. Navigate to an allowed domain (default: TikTok Ads Manager URLs).
6. Use the floating panel to inspect detected elements and run prompts.

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
