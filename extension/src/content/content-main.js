const { DOMScanner } = window.AIOperatorDOMScanner;
const { ActionEngine } = window.AIOperatorActionEngine;
const { parsePrompt } = window.AIOperatorPromptParser;

const allowed = ["ads.tiktok.com", "business.tiktok.com"];
if (!allowed.some((d) => location.hostname.endsWith(d))) {
  console.info("AI Operator disabled on non-allowed domain.");
} else {
  bootstrap();
}

async function bootstrap() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = await (await fetch(chrome.runtime.getURL("src/content/overlay.html"))).text();
  document.documentElement.appendChild(wrapper.firstElementChild);

  const logEl = document.querySelector("#ai-log");
  const elementsEl = document.querySelector("#ai-elements");
  const overlayToggle = document.querySelector("#ai-toggle-boxes");
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
      box.style.left = `${Math.max(0, e.rect.x)}px`;
      box.style.top = `${Math.max(0, e.rect.y)}px`;
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
}
