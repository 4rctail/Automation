chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Browser Operator installed.");
});
const debugState = { lastError: null, lastAction: null, lastToggleAt: null };

chrome.action.onClicked.addListener((tab) => {
  toggleOverlay(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-operator") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleOverlay(tab);
});

async function toggleOverlay(tab) {
  if (!tab?.id || !tab.url) return;
  if (!isAllowedUrl(tab.url)) {
    debugState.lastError = `Blocked URL: ${tab.url}`;
    return;
  }

  const sent = await sendToggle(tab.id);
  if (sent) return;

  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["src/content/overlay.css"] });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      "src/shared/selectors.js",
      "src/content/dom-scanner.js",
      "src/content/action-engine.js",
      "src/content/prompt-parser.js",
      "src/content/content-main.js"
    ]
  });
  await sendToggle(tab.id);
  debugState.lastAction = `toggle:${tab.id}`;
  debugState.lastToggleAt = new Date().toISOString();
}

function isAllowedUrl(url) {
  return /^https:\/\/(ads\.)?tiktok\.com\//.test(url)
    || /^https:\/\/([\w-]+\.)*tiktok\.com\//.test(url)
    || /^file:\/\//.test(url);
}

function sendToggle(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "TOGGLE_AI_OPERATOR" }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_TAB") {
    chrome.tabs.create({ url: message.url }, (tab) => sendResponse({ ok: true, tabId: tab.id }));
    return true;
  }
  if (message?.type === "SWITCH_TAB") {
    chrome.tabs.update(message.tabId, { active: true }, () => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "AI_OPERATOR_DEBUG") {
    sendResponse({ ok: true, debugState });
    return true;
  }
});
