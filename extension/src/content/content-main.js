(() => {
  const isAllowedPage = location.hostname === "tiktok.com"
    || location.hostname.endsWith(".tiktok.com")
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1"
    || location.protocol === "file:";

  if (!isAllowedPage) {
    console.info("AI Operator disabled on non-allowed domain.");
    return;
  }

  if (window.AIOperatorContentMainLoaded) {
    window.AIOperatorShow?.();
    return;
  }
  window.AIOperatorContentMainLoaded = true;

  const { DOMScanner } = window.AIOperatorDOMScanner;
  const { ActionEngine } = window.AIOperatorActionEngine;
  const { parsePrompt } = window.AIOperatorPromptParser;

  bootstrap();

  async function bootstrap() {
    if (document.querySelector("#ai-operator-root")) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = await (await fetch(chrome.runtime.getURL("src/content/overlay.html"))).text();
    document.documentElement.appendChild(wrapper.firstElementChild);

    const rootEl = document.querySelector("#ai-operator-root");
    const promptEl = document.querySelector("#ai-prompt");
    const logEl = document.querySelector("#ai-log");
    const statusEl = document.querySelector("#ai-status");
    const browserTreeEl = document.querySelector("#ai-browser-tree");
    const elementsEl = document.querySelector("#ai-elements");
    const overlayToggle = document.querySelector("#ai-toggle-boxes");
    const saveSelectBtn = document.querySelector("#ai-save-select");
    const saveInstructionBtn = document.querySelector("#ai-save-instruction");
    const loadInstructionInput = document.querySelector("#ai-load-instruction");
    const liveSyncSelect = document.querySelector("#ai-live-sync-select");
    const liveSyncEndpoint = document.querySelector("#ai-live-sync-endpoint");
    const fetchInstructionBtn = document.querySelector("#ai-fetch-instruction");
    const instructionEndpoint = document.querySelector("#ai-instruction-endpoint");
    const diagnosticsButton = document.querySelector("#ai-diagnostics-button");
    const refreshContextButton = document.querySelector("#ai-refresh-context");
    const diagnosticsEl = document.querySelector("#ai-diagnostics");
    let currentSnapshot = [];
    let visibleText = [];
    let browserContext = fallbackBrowserContext();
    let overlaysVisible = false;
    let boxes = [];
    let liveSyncTimer = null;

    const logger = (msg) => {
      logEl.textContent += `\n${new Date().toISOString()} ${msg}`;
      logEl.scrollTop = logEl.scrollHeight;
    };

    const showOperator = () => {
      rootEl.style.display = "block";
      logger("Overlay shown.");
      refreshBrowserContext();
    };

    const toggleOperator = () => {
      const isHidden = rootEl.style.display === "none";
      rootEl.style.display = isHidden ? "block" : "none";
      if (!isHidden) clearBoxes();
      else refreshBrowserContext();
      logger(`Overlay ${isHidden ? "shown" : "hidden"}.`);
    };

    window.AIOperatorShow = showOperator;
    window.AIOperatorToggle = toggleOperator;

    const clearBoxes = () => {
      boxes.forEach((n) => n.remove());
      boxes = [];
    };

    const drawBoxes = (elements) => {
      clearBoxes();
      boxes = elements.slice(0, 40).map((e) => {
        const box = document.createElement("div");
        box.className = "ai-overlay-box";
        const left = Number.isFinite(e.rect.x) ? e.rect.x : e.rect.left;
        const top = Number.isFinite(e.rect.y) ? e.rect.y : e.rect.top;
        box.style.left = `${Math.max(0, left)}px`;
        box.style.top = `${Math.max(0, top)}px`;
        box.style.width = `${Math.max(1, e.rect.width)}px`;
        box.style.height = `${Math.max(1, e.rect.height)}px`;
        const label = document.createElement("div");
        label.className = "ai-overlay-label";
        label.textContent = `${e.id} ${e.kind}: ${e.label || e.selector || e.tag}`;
        box.appendChild(label);
        document.body.appendChild(box);
        return box;
      });
    };

    const render = () => {
      renderStatus(statusEl, currentSnapshot, visibleText, browserContext);
      renderBrowserTree(browserTreeEl, browserContext, currentSnapshot, visibleText);
      renderFlatElementList(elementsEl, currentSnapshot);
    };

    const scheduleLiveSync = () => {
      if (!liveSyncSelect.checked) return;
      clearTimeout(liveSyncTimer);
      liveSyncTimer = setTimeout(() => postBrowserSelect(), 1000);
    };

    const scanner = new DOMScanner((snapshot) => {
      currentSnapshot = snapshot.elements;
      visibleText = snapshot.visibleText || [];
      render();
      scheduleLiveSync();
      if (overlaysVisible) drawBoxes(currentSnapshot);
    });

    const engine = new ActionEngine({
      scanner,
      logger,
      highlighter: (el) => {
        el.classList.add("ai-highlight");
        setTimeout(() => el.classList.remove("ai-highlight"), 1200);
      }
    });

    scanner.start();
    refreshBrowserContext();
    logger(`Overlay bootstrapped on ${location.href}`);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === "AI_OPERATOR_PING") {
        sendResponse({ ok: true, loaded: true, url: location.href });
        return true;
      }
      if (message?.type === "SHOW_AI_OPERATOR") {
        showOperator();
        sendResponse({ ok: true });
        return true;
      }
      if (message?.type === "TOGGLE_AI_OPERATOR") {
        toggleOperator();
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });

    overlayToggle.addEventListener("click", () => {
      overlaysVisible = !overlaysVisible;
      overlayToggle.textContent = overlaysVisible ? "Hide Found Overlays" : "Show Found Overlays";
      if (overlaysVisible) drawBoxes(currentSnapshot);
      else clearBoxes();
    });

    browserTreeEl.addEventListener("click", handleElementRowClick);
    elementsEl.addEventListener("click", handleElementRowClick);

    document.querySelector("#ai-run").addEventListener("click", async () => {
      const actions = parsePrompt(promptEl.value);
      if (!actions.length) return engine.logger("No parseable action.");

      for (const action of actions) {
        if (["delete", "remove", "publish", "disable"].some((w) => String(action.target || action.value || "").toLowerCase().includes(w))) {
          const confirmed = confirm(`Confirm destructive action: ${JSON.stringify(action)}`);
          if (!confirmed) continue;
        }
        await engine.enqueue(action);
      }
    });

    saveSelectBtn.addEventListener("click", () => {
      downloadTextFile("BrowserSelect.txt", formatBrowserSelect(currentSnapshot, browserContext, visibleText));
      engine.logger(`Saved BrowserSelect.txt with ${currentSnapshot.length} entries and ${visibleText.length} text snippets.`);
    });

    saveInstructionBtn.addEventListener("click", () => {
      const body = [
        "# BrowserInstruction.txt",
        "# Lines beginning with '#' are comments/metadata and are excluded from instruction parsing.",
        "# Put one instruction per line below:",
        "",
        promptEl.value || ""
      ].join("\n");
      downloadTextFile("BrowserInstruction.txt", body);
      engine.logger("Saved BrowserInstruction.txt.");
    });

    loadInstructionInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const raw = await file.text();
      promptEl.value = parseInstructionText(raw);
      engine.logger(`Loaded instructions from ${file.name}.`);
    });

    liveSyncSelect.addEventListener("change", () => {
      if (liveSyncSelect.checked) postBrowserSelect();
    });

    fetchInstructionBtn.addEventListener("click", async () => {
      try {
        const response = await fetch(instructionEndpoint.value || "http://localhost:8787/BrowserInstruction.txt");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        promptEl.value = parseInstructionText(await response.text());
        engine.logger(`Fetched instructions from ${instructionEndpoint.value}.`);
      } catch (err) {
        engine.logger(`Instruction fetch failed: ${err.message}`);
      }
    });

    refreshContextButton.addEventListener("click", refreshBrowserContext);

    diagnosticsButton.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "AI_OPERATOR_DEBUG" }, (res) => {
        diagnosticsEl.textContent = JSON.stringify({
          content: {
            url: location.href,
            detectedElements: currentSnapshot.length,
            visibleTextCount: visibleText.length,
            browserWindows: browserContext.windows?.length || 0,
            browserTabs: browserContext.browser?.tabCount || 0,
            liveSyncEnabled: liveSyncSelect.checked,
            liveSyncEndpoint: liveSyncEndpoint.value
          },
          serviceWorker: res?.debugState || {},
          runtimeError: chrome.runtime.lastError?.message || null
        }, null, 2);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "y") toggleOperator();
    });

    setInterval(() => {
      chrome.runtime.sendMessage({ type: "AI_OPERATOR_DEBUG" }, (res) => {
        if (!res?.ok) return;
        const d = res.debugState || {};
        rootEl.dataset.debug = `${d.lastAction || "-"} | ${d.lastError || "ok"}`;
      });
    }, 3000);

    setInterval(refreshBrowserContext, 5000);

    function refreshBrowserContext() {
      chrome.runtime.sendMessage({ type: "AI_OPERATOR_BROWSER_CONTEXT" }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          logger(`Browser context refresh failed: ${chrome.runtime.lastError?.message || res?.error || "unknown error"}`);
          browserContext = fallbackBrowserContext();
        } else {
          browserContext = res.context;
        }
        render();
        scheduleLiveSync();
      });
    }

    function handleElementRowClick(event) {
      const row = event.target.closest("[data-idx]");
      if (!row) return;
      const idx = Number(row.dataset.idx);
      const entry = currentSnapshot[idx];
      if (!entry) return;
      const target = findElementForEntry(entry);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("ai-highlight");
        setTimeout(() => target.classList.remove("ai-highlight"), 1200);
      }
    }

    async function postBrowserSelect() {
      try {
        const endpoint = liveSyncEndpoint.value || "http://localhost:8787/BrowserSelect.txt";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: formatBrowserSelect(currentSnapshot, browserContext, visibleText)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        logger(`Live synced BrowserSelect.txt to ${endpoint}.`);
      } catch (err) {
        logger(`Live sync failed: ${err.message}`);
      }
    }
  }

  function renderStatus(statusEl, elements, texts, context) {
    const warning = elements.length === 0 ? " No detectable page controls found. Try interacting with the page or inspect scanner selectors." : "";
    const tabCount = context?.browser?.tabCount || 0;
    statusEl.textContent = `PC → Browser → Tabs loaded: ${tabCount} | Current page controls: ${elements.length} | Text snippets: ${texts.length} | URL: ${location.href}${warning}`;
    statusEl.classList.toggle("ai-status-warning", elements.length === 0);
  }

  function renderBrowserTree(container, context, elements, texts) {
    container.textContent = "";
    const tree = document.createElement("details");
    tree.className = "ai-tree-node ai-tree-pc";
    tree.open = true;

    const pcSummary = document.createElement("summary");
    pcSummary.textContent = `PC: ${context.pc?.label || "This PC"} (${context.pc?.os || "unknown OS"}, ${context.pc?.arch || "unknown arch"})`;
    tree.appendChild(pcSummary);

    const browserNode = document.createElement("details");
    browserNode.className = "ai-tree-node ai-tree-browser";
    browserNode.open = true;
    const browserSummary = document.createElement("summary");
    browserSummary.textContent = `Browser: ${context.browser?.label || "Current Chromium browser"} (${context.browser?.windowCount || 0} windows, ${context.browser?.tabCount || 0} tabs)`;
    browserNode.appendChild(browserSummary);
    browserNode.appendChild(renderTabsNode(context));
    browserNode.appendChild(renderPageNode(elements, texts));
    tree.appendChild(browserNode);
    container.appendChild(tree);
  }

  function renderTabsNode(context) {
    const tabsNode = document.createElement("details");
    tabsNode.className = "ai-tree-node ai-tree-tabs";
    const summary = document.createElement("summary");
    summary.textContent = `Tabs and windows (${context.browser?.tabCount || 0})`;
    tabsNode.appendChild(summary);

    (context.windows || []).forEach((browserWindow) => {
      const windowNode = document.createElement("details");
      windowNode.className = "ai-tree-node ai-tree-window";
      windowNode.open = browserWindow.focused;
      const windowSummary = document.createElement("summary");
      windowSummary.textContent = `Window ${browserWindow.id}${browserWindow.focused ? " (focused)" : ""} · ${browserWindow.state || "unknown"}`;
      windowNode.appendChild(windowSummary);

      (browserWindow.tabs || []).forEach((tab) => {
        const tabRow = document.createElement("div");
        tabRow.className = `ai-tab-row${tab.id === context.currentTabId ? " ai-current-tab" : ""}`;
        tabRow.textContent = `${tab.active ? "▶ " : ""}${tab.title} — ${tab.url || "no URL"}`;
        windowNode.appendChild(tabRow);
      });
      tabsNode.appendChild(windowNode);
    });

    return tabsNode;
  }

  function renderPageNode(elements, texts) {
    const pageNode = document.createElement("details");
    pageNode.className = "ai-tree-node ai-tree-page";
    pageNode.open = true;
    const summary = document.createElement("summary");
    summary.textContent = `Current Page Details: ${document.title || "Untitled"}`;
    pageNode.appendChild(summary);
    pageNode.appendChild(renderKeyValue("URL", location.href));
    pageNode.appendChild(renderKeyValue("Detected controls", String(elements.length)));
    pageNode.appendChild(renderKeyValue("Visible text snippets", String(texts.length)));

    const groups = groupElementsByKind(elements);
    ["button", "link", "input", "dropdown", "toggle", "tab", "dialog", "unknown"].forEach((kind) => {
      pageNode.appendChild(renderElementGroup(kind, groups[kind] || []));
    });
    pageNode.appendChild(renderTextGroup(texts));

    return pageNode;
  }

  function renderElementGroup(kind, entries) {
    const group = document.createElement("details");
    group.className = "ai-tree-node ai-element-group";
    group.open = ["button", "input", "dropdown", "toggle"].includes(kind) && entries.length > 0;
    const summary = document.createElement("summary");
    summary.textContent = `${capitalize(kind)}s (${entries.length})`;
    group.appendChild(summary);
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "ai-empty-row";
      empty.textContent = "None detected.";
      group.appendChild(empty);
      return group;
    }
    entries.forEach(({ element, index }) => group.appendChild(createElementRow(element, index)));
    return group;
  }

  function renderTextGroup(texts) {
    const group = document.createElement("details");
    group.className = "ai-tree-node ai-text-group";
    const summary = document.createElement("summary");
    summary.textContent = `Visible Texts (${texts.length})`;
    group.appendChild(summary);
    texts.slice(0, 80).forEach((text, index) => {
      const row = document.createElement("div");
      row.className = "ai-text-row";
      row.textContent = `#${index + 1} ${text}`;
      group.appendChild(row);
    });
    if (texts.length > 80) {
      const more = document.createElement("div");
      more.className = "ai-empty-row";
      more.textContent = `…${texts.length - 80} more text snippets omitted from display.`;
      group.appendChild(more);
    }
    return group;
  }

  function renderFlatElementList(container, elements) {
    container.textContent = "";
    const title = document.createElement("div");
    title.className = "ai-section-title";
    title.textContent = "Flat current-page controls";
    container.appendChild(title);
    elements.forEach((element, index) => container.appendChild(createElementRow(element, index)));
  }

  function createElementRow(element, index) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ai-element-item";
    row.dataset.idx = String(index);

    const meta = document.createElement("div");
    meta.className = "ai-element-meta";
    meta.textContent = `#${index + 1} · ${element.tag}`;

    const kind = document.createElement("span");
    kind.className = "ai-element-kind";
    kind.textContent = element.kind || "unknown";
    meta.appendChild(kind);

    const label = document.createElement("div");
    label.className = "ai-element-label";
    label.textContent = element.label || "No accessible label";

    const selector = document.createElement("div");
    selector.className = "ai-element-selector";
    selector.textContent = element.exactSelector || element.selector;

    row.append(meta, label, selector);
    return row;
  }

  function formatBrowserSelect(elements, context = fallbackBrowserContext(), texts = []) {
    const lines = [
      "# BrowserSelect.txt",
      `# Generated: ${new Date().toISOString()}`,
      "# Hierarchy: PC > Browser > Windows/Tabs > Current Page Details > Page Controls/Text",
      "",
      `[PC] ${context.pc?.label || "This PC"}`,
      `os=${context.pc?.os || "unknown"} arch=${context.pc?.arch || "unknown"} userAgent=${context.pc?.userAgent || navigator.userAgent}`,
      "",
      `[Browser] ${context.browser?.label || "Current Chromium browser"}`,
      `windows=${context.browser?.windowCount || 0} tabs=${context.browser?.tabCount || 0} runtime=${context.browser?.runtime || "content script"}`,
      ""
    ];

    (context.windows || []).forEach((browserWindow) => {
      lines.push(`[Window] id=${browserWindow.id} focused=${!!browserWindow.focused} state=${browserWindow.state || "unknown"}`);
      (browserWindow.tabs || []).forEach((tab) => {
        lines.push(`  [Tab] id=${tab.id} active=${!!tab.active} title=${sanitizeText(tab.title)} url=${tab.url || ""}`);
      });
      lines.push("");
    });

    lines.push(`[Current Page] title=${sanitizeText(document.title || "Untitled")}`);
    lines.push(`url=${location.href}`);
    lines.push(`controls=${elements.length} visibleTexts=${texts.length}`);
    lines.push("");
    lines.push("# Page Controls Format: index | id | kind | tag | role | type | label | exactSelector | semanticSelector");
    elements.forEach((e, index) => {
      lines.push(`${index + 1} | ${e.id} | ${e.kind || "unknown"} | ${e.tag} | ${e.role || "-"} | ${e.type || "-"} | ${sanitizeText(e.label || "-")} | ${e.exactSelector || "-"} | ${e.selector}`);
    });
    lines.push("");
    lines.push("# Visible Texts");
    texts.forEach((text, index) => lines.push(`${index + 1} | ${sanitizeText(text)}`));
    return lines.join("\n");
  }

  function parseInstructionText(raw) {
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .join("\n");
  }

  function findElementForEntry(entry) {
    try {
      const selector = entry.exactSelector || (entry.selector.startsWith("#") || entry.selector.includes("[") ? entry.selector : entry.tag);
      return document.querySelector(selector);
    } catch (err) {
      return null;
    }
  }

  function groupElementsByKind(elements) {
    return elements.reduce((groups, element, index) => {
      const kind = element.kind || "unknown";
      if (!groups[kind]) groups[kind] = [];
      groups[kind].push({ element, index });
      return groups;
    }, {});
  }

  function renderKeyValue(key, value) {
    const row = document.createElement("div");
    row.className = "ai-kv-row";
    const keyEl = document.createElement("span");
    keyEl.textContent = `${key}: `;
    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    row.append(keyEl, valueEl);
    return row;
  }

  function fallbackBrowserContext() {
    return {
      pc: { label: "This PC", os: "unknown", arch: "unknown", naclArch: "unknown", userAgent: navigator.userAgent },
      browser: { label: "Current Chromium browser", runtime: "content script", windowCount: 1, tabCount: 1 },
      currentTabId: null,
      windows: [{
        id: "current",
        focused: true,
        state: "current",
        tabs: [{
          id: "current",
          active: true,
          title: document.title || "Current page",
          url: location.href
        }]
      }]
    };
  }

  function sanitizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
})();
