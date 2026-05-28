(() => {
  if (window.AIOperatorContentMainLoaded) {
    window.AIOperatorShow?.();
    return;
  }
  window.AIOperatorContentMainLoaded = true;

  const { DOMScanner } = window.AIOperatorDOMScanner;
  const { ActionEngine } = window.AIOperatorActionEngine;
  const { parsePrompt } = window.AIOperatorPromptParser;

  const allowedHosts = ["ads.tiktok.com", "business.tiktok.com"];
  const isAllowedPage = allowedHosts.some((d) => location.hostname === d || location.hostname.endsWith(`.${d}`))
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1"
    || location.protocol === "file:";

  if (!isAllowedPage) {
    console.info("AI Operator disabled on non-allowed domain.");
    return;
  }

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
    const diagnosticsEl = document.querySelector("#ai-diagnostics");
    let currentSnapshot = [];
    let visibleText = [];
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
    };

    const toggleOperator = () => {
      const isHidden = rootEl.style.display === "none";
      rootEl.style.display = isHidden ? "block" : "none";
      if (!isHidden) clearBoxes();
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

    const renderElements = () => {
      elementsEl.textContent = "";
      currentSnapshot.forEach((e, i) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "ai-element-item";
        row.dataset.idx = String(i);

        const meta = document.createElement("div");
        meta.className = "ai-element-meta";
        meta.textContent = `#${i + 1} · ${e.tag}`;

        const kind = document.createElement("span");
        kind.className = "ai-element-kind";
        kind.textContent = e.kind || "unknown";
        meta.appendChild(kind);

        const label = document.createElement("div");
        label.className = "ai-element-label";
        label.textContent = e.label || "No accessible label";

        const selector = document.createElement("div");
        selector.className = "ai-element-selector";
        selector.textContent = e.selector;

        row.append(meta, label, selector);
        elementsEl.appendChild(row);
      });
    };

    const renderStatus = () => {
      const warning = currentSnapshot.length === 0 ? " No detectable elements found. Try interacting with the page or inspect scanner selectors." : "";
      statusEl.textContent = `Detected elements: ${currentSnapshot.length} | URL: ${location.href}${warning}`;
      statusEl.classList.toggle("ai-status-warning", currentSnapshot.length === 0);
    };

    const scheduleLiveSync = () => {
      if (!liveSyncSelect.checked) return;
      clearTimeout(liveSyncTimer);
      liveSyncTimer = setTimeout(() => postBrowserSelect(), 1000);
    };

    const scanner = new DOMScanner((snapshot) => {
      currentSnapshot = snapshot.elements;
      visibleText = snapshot.visibleText || [];
      renderStatus();
      renderElements();
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

    elementsEl.addEventListener("click", (event) => {
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
    });

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
      downloadTextFile("BrowserSelect.txt", formatBrowserSelect(currentSnapshot));
      engine.logger(`Saved BrowserSelect.txt with ${currentSnapshot.length} entries.`);
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

    diagnosticsButton.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "AI_OPERATOR_DEBUG" }, (res) => {
        diagnosticsEl.textContent = JSON.stringify({
          content: {
            url: location.href,
            detectedElements: currentSnapshot.length,
            visibleTextCount: visibleText.length,
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

    async function postBrowserSelect() {
      try {
        const endpoint = liveSyncEndpoint.value || "http://localhost:8787/BrowserSelect.txt";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: formatBrowserSelect(currentSnapshot)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        logger(`Live synced BrowserSelect.txt to ${endpoint}.`);
      } catch (err) {
        logger(`Live sync failed: ${err.message}`);
      }
    }
  }

  function formatBrowserSelect(elements) {
    const lines = [
      "# BrowserSelect.txt",
      `# Generated: ${new Date().toISOString()}`,
      `# URL: ${location.href}`,
      "# Format: index | id | kind | tag | role | type | label | selector",
      ""
    ];
    elements.forEach((e, index) => {
      lines.push(`${index + 1} | ${e.id} | ${e.kind || "unknown"} | ${e.tag} | ${e.role || "-"} | ${e.type || "-"} | ${(e.label || "-").replace(/\s+/g, " ")} | ${e.selector}`);
    });
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
      const selector = entry.selector.startsWith("#") || entry.selector.includes("[") ? entry.selector : entry.tag;
      return document.querySelector(selector);
    } catch (err) {
      return null;
    }
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
