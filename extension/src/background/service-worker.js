chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Browser Operator installed.");
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
