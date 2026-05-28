const { DOMScanner } = window.AIOperatorDOMScanner;
const { ActionEngine } = window.AIOperatorActionEngine;
const { parsePrompt } = window.AIOperatorPromptParser;

const allowed = ["ads.tiktok.com", "business.tiktok.com"];
if (!(allowed.some((d) => location.hostname.endsWith(d)) || location.protocol === "file:")) {
  console.info("AI Operator disabled on non-allowed domain.");
} else {
  bootstrap();
}

async function bootstrap() {
  if (document.querySelector("#ai-operator-root")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = await (await fetch(chrome.runtime.getURL("src/content/overlay.html"))).text();
  document.documentElement.appendChild(wrapper.firstElementChild);

  const logEl = document.querySelector("#ai-log");
  const elementsEl = document.querySelector("#ai-elements");
  const overlayToggle = document.querySelector("#ai-toggle-boxes");
  const saveSelectBtn = document.querySelector("#ai-save-select");
  const saveInstructionBtn = document.querySelector("#ai-save-instruction");
  const loadInstructionInput = document.querySelector("#ai-load-instruction");
  const rootEl = document.querySelector("#ai-operator-root");
  let currentSnapshot = [];
  let overlaysVisible = false;
  let boxes = [];

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
      label.textContent = e.label || e.selector || e.tag;
      box.appendChild(label);
      document.body.appendChild(box);
      return box;
    });
  };

  const scanner = new DOMScanner((snapshot) => {
    currentSnapshot = snapshot.elements.slice(0, 40);
    elementsEl.innerHTML = currentSnapshot
      .map((e, i) => `<div class="ai-element-item" data-idx="${i}">${e.tag} :: ${e.label || e.selector}</div>`)
      .join("");
    if (overlaysVisible) drawBoxes(currentSnapshot);
  });

  const engine = new ActionEngine({
    scanner,
    logger: (msg) => { logEl.textContent += `\n${new Date().toISOString()} ${msg}`; },
    highlighter: (el) => {
      el.classList.add("ai-highlight");
      setTimeout(() => el.classList.remove("ai-highlight"), 1200);
    }
  });

  scanner.start();
  engine.logger(`Overlay bootstrapped on ${location.href}`);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "TOGGLE_AI_OPERATOR") return;
    const isHidden = rootEl.style.display === "none";
    rootEl.style.display = isHidden ? "block" : "none";
    if (!isHidden) clearBoxes();
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
    const target = document.querySelector(entry.selector.startsWith("#") || entry.selector.includes("[") ? entry.selector : entry.tag);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ai-highlight");
      setTimeout(() => target.classList.remove("ai-highlight"), 1200);
    }
  });

  document.querySelector("#ai-run").addEventListener("click", async () => {
    const prompt = document.querySelector("#ai-prompt").value;
    const actions = parsePrompt(prompt);
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
    const lines = [
      "# BrowserSelect.txt",
      `# Generated: ${new Date().toISOString()}`,
      `# URL: ${location.href}`,
      "# Format: id | tag | role | type | label | selector",
      ""
    ];
    currentSnapshot.forEach((e) => {
      lines.push(`${e.id} | ${e.tag} | ${e.role || "-"} | ${e.type || "-"} | ${(e.label || "-").replace(/\n/g, " ")} | ${e.selector}`);
    });
    downloadTextFile("BrowserSelect.txt", lines.join("\n"));
    engine.logger(`Saved BrowserSelect.txt with ${currentSnapshot.length} entries.`);
  });

  saveInstructionBtn.addEventListener("click", () => {
    const prompt = document.querySelector("#ai-prompt").value || "";
    const body = [
      "# BrowserInstruction.txt",
      "# Lines beginning with '#' are comments/metadata and are excluded from instruction parsing.",
      "# Put one instruction per line below:",
      "",
      prompt
    ].join("\n");
    downloadTextFile("BrowserInstruction.txt", body);
    engine.logger("Saved BrowserInstruction.txt.");
  });

  loadInstructionInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const parsed = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .join("\n");
    document.querySelector("#ai-prompt").value = parsed;
    engine.logger(`Loaded instructions from ${file.name}.`);
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "y") {
      const isHidden = rootEl.style.display === "none";
      rootEl.style.display = isHidden ? "block" : "none";
      engine.logger(`Local keybind toggle: ${isHidden ? "show" : "hide"}`);
    }
  });

  setInterval(() => {
    chrome.runtime.sendMessage({ type: "AI_OPERATOR_DEBUG" }, (res) => {
      if (!res?.ok) return;
      const d = res.debugState || {};
      rootEl.dataset.debug = `${d.lastAction || "-"} | ${d.lastError || "ok"}`;
    });
  }, 3000);
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
