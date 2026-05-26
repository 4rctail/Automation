chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Browser Operator installed.");
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_AI_OPERATOR" }, () => {
    void chrome.runtime.lastError;
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_TAB") {
    chrome.tabs.create({ url: message.url }, (tab) => sendResponse({ ok: true, tabId: tab.id }));
    return true;
  }
  if (message?.type === "SWITCH_TAB") {
    chrome.tabs.update(message.tabId, { active: true }, () => sendResponse({ ok: true }));
    return true;
  }
});
