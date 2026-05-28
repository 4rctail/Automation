const MAX_NETWORK_EVENTS = 75;
const networkEvents = [];

const pageUrlEl = document.querySelector("#page-url");
const pageTitleEl = document.querySelector("#page-title");
const pageUserAgentEl = document.querySelector("#page-user-agent");
const refreshPageInfoButton = document.querySelector("#refresh-page-info");
const clearNetworkButton = document.querySelector("#clear-network");
const networkSummaryEl = document.querySelector("#network-summary");
const networkListEl = document.querySelector("#network-list");
const logEl = document.querySelector("#devtools-log");

function log(message) {
  logEl.textContent += `${new Date().toISOString()} ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function evaluateInInspectedPage(expression) {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo) {
        reject(new Error(exceptionInfo.value || exceptionInfo.description || "Inspected page evaluation failed."));
        return;
      }
      resolve(result);
    });
  });
}

async function refreshPageInfo() {
  pageUrlEl.textContent = chrome.devtools.inspectedWindow.tabId
    ? `Tab ${chrome.devtools.inspectedWindow.tabId}`
    : "Unknown tab";

  try {
    const pageInfo = await evaluateInInspectedPage(`({
      url: location.href,
      title: document.title,
      userAgent: navigator.userAgent
    })`);

    pageUrlEl.textContent = pageInfo.url || "Unknown URL";
    pageTitleEl.textContent = pageInfo.title || "Untitled page";
    pageUserAgentEl.textContent = pageInfo.userAgent || "Unknown user agent";
    log("Refreshed inspected page information.");
  } catch (err) {
    pageTitleEl.textContent = "Unable to read page title.";
    pageUserAgentEl.textContent = "Unable to read user agent.";
    log(`Page info error: ${err.message}`);
  }
}

function addNetworkEvent(request) {
  const startedAt = new Date().toISOString();
  const entry = {
    method: request.request?.method || "GET",
    url: request.request?.url || "Unknown URL",
    status: request.response?.status || 0,
    statusText: request.response?.statusText || "",
    mimeType: request.response?.content?.mimeType || "unknown",
    startedAt
  };

  networkEvents.unshift(entry);
  if (networkEvents.length > MAX_NETWORK_EVENTS) networkEvents.pop();
  renderNetworkEvents();
}

function renderNetworkEvents() {
  networkSummaryEl.textContent = networkEvents.length
    ? `${networkEvents.length} recent request${networkEvents.length === 1 ? "" : "s"} captured.`
    : "No requests captured yet.";

  networkListEl.replaceChildren(...networkEvents.map((event) => {
    const item = document.createElement("li");

    const url = document.createElement("div");
    url.textContent = event.url;

    const meta = document.createElement("div");
    meta.className = "network-meta";
    meta.textContent = `${event.method} • ${event.status} ${event.statusText} • ${event.mimeType} • ${event.startedAt}`;

    item.append(url, meta);
    return item;
  }));
}

refreshPageInfoButton.addEventListener("click", refreshPageInfo);
clearNetworkButton.addEventListener("click", () => {
  networkEvents.length = 0;
  renderNetworkEvents();
  log("Cleared network events.");
});

chrome.devtools.network.onRequestFinished.addListener(addNetworkEvent);

refreshPageInfo();
renderNetworkEvents();
log("AI Operator DevTools panel ready.");
