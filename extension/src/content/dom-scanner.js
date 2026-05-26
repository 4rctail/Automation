const { buildSemanticLabel, stableSelector } = window.AIOperatorSelectors;

const CANDIDATE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[role='dialog']",
  "[role='switch']",
  "[role='combobox']",
  "label",
  "dialog"
].join(",");

class DOMScanner {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.map = [];
    this.observer = null;
  }

  start() {
    this.scan();
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener("scroll", () => this.scan(), { passive: true });
    window.addEventListener("resize", () => this.scan(), { passive: true });
  }

  stop() {
    this.observer?.disconnect();
  }

  scan() {
    const candidates = [...document.querySelectorAll(CANDIDATE_SELECTOR)].filter(isVisible);
    const visibleTextNodes = [...document.querySelectorAll("body *")]
      .filter((n) => n.childElementCount === 0 && isVisible(n))
      .map((n) => n.textContent?.trim())
      .filter((t) => t && t.length > 1);

    this.map = candidates.map((el, idx) => {
      const text = (el.innerText || el.textContent || "").trim();
      if (text && text.length < 80) {
        el.setAttribute("data-ai-text", text);
      }
      return ({
      id: `el-${idx}`,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      type: el.getAttribute("type") || "",
      label: buildSemanticLabel(el),
      selector: stableSelector(el),
      disabled: !!el.disabled,
      rect: el.getBoundingClientRect().toJSON()
    });
    });

    this.onUpdate?.({ elements: this.map, visibleText: visibleTextNodes.slice(0, 200) });
  }
}

window.AIOperatorDOMScanner = { DOMScanner };

function isVisible(el) {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
