chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Browser Operator installed.");
});

const debugState = {
  lastUrl: null,
  lastAction: null,
  lastError: null,
  lastInjectionAt: null,
  lastShowAt: null,
  lastToggleAt: null
};

chrome.action.onClicked.addListener((tab) => {
  showOverlay(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-operator") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleOverlay(tab);
});

async function showOverlay(tab) {
  await ensureOperator(tab, "SHOW_AI_OPERATOR");
}

async function toggleOverlay(tab) {
  await ensureOperator(tab, "TOGGLE_AI_OPERATOR");
}

async function ensureOperator(tab, messageType) {
  debugState.lastUrl = tab?.url || null;
  debugState.lastAction = `${messageType}:requested`;
  debugState.lastError = null;

  if (!tab?.id || !tab.url) {
    debugState.lastError = "Missing active tab id or URL.";
    return;
  }

  if (!isAllowedUrl(tab.url)) {
    debugState.lastError = `Blocked URL: ${tab.url}`;
    debugState.lastAction = `${messageType}:blocked`;
    return;
  }

  const isReady = await pingOperator(tab.id);
  let finalMessageType = messageType;
  if (!isReady) {
    const injected = await injectOperator(tab.id);
    if (!injected) return;
    finalMessageType = "SHOW_AI_OPERATOR";
    const becameReady = await waitForOperator(tab.id);
    if (!becameReady) {
      debugState.lastError = "Injected scripts did not respond to AI_OPERATOR_PING.";
      debugState.lastAction = `inject:not-ready:${tab.id}`;
      return;
    }
  }

  await sendOperatorMessage(tab.id, finalMessageType);
  debugState.lastAction = `${finalMessageType}:sent:${tab.id}`;
  const now = new Date().toISOString();
  if (finalMessageType === "SHOW_AI_OPERATOR") debugState.lastShowAt = now;
  if (finalMessageType === "TOGGLE_AI_OPERATOR") debugState.lastToggleAt = now;
}

async function injectOperator(tabId) {
  try {
    debugState.lastAction = `inject:start:${tabId}`;
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content/overlay.css"] });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "src/shared/selectors.js",
        "src/content/dom-scanner.js",
        "src/content/action-engine.js",
        "src/content/prompt-parser.js",
        "src/content/content-main.js"
      ]
    });
    debugState.lastInjectionAt = new Date().toISOString();
    debugState.lastAction = `inject:complete:${tabId}`;
    return true;
  } catch (err) {
    debugState.lastError = `Injection failed: ${err.message}`;
    debugState.lastAction = `inject:failed:${tabId}`;
    return false;
  }
}

function isAllowedUrl(url) {
  return /^https:\/\/(ads\.)?tiktok\.com\//.test(url)
    || /^https:\/\/([\w-]+\.)*tiktok\.com\//.test(url)
    || /^file:\/\//.test(url)
    || /^http:\/\/localhost(?::\d+)?\//.test(url)
    || /^http:\/\/127\.0\.0\.1(?::\d+)?\//.test(url);
}

async function waitForOperator(tabId, attempts = 20, delayMs = 250) {
  for (let i = 0; i < attempts; i += 1) {
    if (await pingOperator(tabId)) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

function pingOperator(tabId) {
  return sendOperatorMessage(tabId, "AI_OPERATOR_PING");
}

function sendOperatorMessage(tabId, type) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        if (type !== "AI_OPERATOR_PING") debugState.lastError = error.message;
        resolve(false);
        return;
      }
      resolve(true);
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
    debugState.lastUrl = sender?.tab?.url || debugState.lastUrl;
    sendResponse({ ok: true, debugState });
    return true;
  }
  if (message?.type === "AI_OPERATOR_BROWSER_CONTEXT") {
    collectBrowserContext(sender)
      .then((context) => sendResponse({ ok: true, context }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function collectBrowserContext(sender) {
  const [platform, windows] = await Promise.all([
    getPlatformInfo(),
    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] })
  ]);

  return {
    pc: {
      label: "This PC",
      os: platform.os,
      arch: platform.arch,
      naclArch: platform.nacl_arch,
      userAgent: navigator.userAgent
    },
    browser: {
      label: chrome.runtime.getManifest().name,
      runtime: "Chromium extension",
      windowCount: windows.length,
      tabCount: windows.reduce((sum, browserWindow) => sum + (browserWindow.tabs?.length || 0), 0)
    },
    currentTabId: sender?.tab?.id || null,
    windows: windows.map((browserWindow) => ({
      id: browserWindow.id,
      focused: browserWindow.focused,
      state: browserWindow.state,
      type: browserWindow.type,
      tabs: (browserWindow.tabs || []).map((tab) => ({
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        active: tab.active,
        highlighted: tab.highlighted,
        pinned: tab.pinned,
        audible: tab.audible,
        status: tab.status,
        title: tab.title || "Untitled tab",
        url: tab.url || "",
        favIconUrl: tab.favIconUrl || ""
      }))
    }))
  };
}

function getPlatformInfo() {
  return new Promise((resolve) => {
    chrome.runtime.getPlatformInfo(resolve);
  });
}
