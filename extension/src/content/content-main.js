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
  const scanner = new DOMScanner((snapshot) => {
    elementsEl.innerHTML = snapshot.elements.slice(0, 40).map((e) => `<div>${e.tag} :: ${e.label || e.selector}</div>`).join("");
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
