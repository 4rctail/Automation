(() => {
  if (window.AIOperatorDOMScannerLoaded) return;
  window.AIOperatorDOMScannerLoaded = true;

  const { buildSemanticLabel, stableSelector } = window.AIOperatorSelectors;

  const EXACT_TARGET_ATTRIBUTE = "data-ai-operator-id";

  const CANDIDATE_SELECTOR = [
    "button",
    "a[href]",
    "input",
    "textarea",
    "select",
    "[tabindex]",
    "[contenteditable='true']",
    "[role='button']",
    "[role='link']",
    "[role='dialog']",
    "[role='switch']",
    "[role='combobox']",
    "[role='textbox']",
    "[role='menuitem']",
    "[role='option']",
    "[role='listbox']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='tab']",
    "[role='tabpanel']",
    "[role='menu']",
    "[aria-haspopup]",
    "[aria-expanded]",
    "[aria-controls]",
    "label",
    "dialog"
  ].join(",");

  class DOMScanner {
    constructor(onUpdate) {
      this.onUpdate = onUpdate;
      this.map = [];
      this.observer = null;
      this.nextId = 0;
      this.handleScan = () => this.scan();
    }

    start() {
      this.scan();
      this.observer = new MutationObserver(() => this.scan());
      this.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      window.addEventListener("scroll", this.handleScan, { passive: true });
      window.addEventListener("resize", this.handleScan, { passive: true });
    }

    stop() {
      this.observer?.disconnect();
      window.removeEventListener("scroll", this.handleScan);
      window.removeEventListener("resize", this.handleScan);
    }

    scan() {
      const candidates = [...document.querySelectorAll(CANDIDATE_SELECTOR)]
        .filter((el) => !el.closest("#ai-operator-root") && isVisible(el));
      const visibleTextNodes = [...document.querySelectorAll("body *")]
        .filter((n) => !n.closest("#ai-operator-root") && n.childElementCount === 0 && isVisible(n))
        .map((n) => n.textContent?.trim())
        .filter((t) => t && t.length > 1);

      this.map = candidates.map((el) => {
        const text = (el.innerText || el.textContent || "").trim();
        let id = el.getAttribute(EXACT_TARGET_ATTRIBUTE);
        if (!id) {
          id = `el-${this.nextId}`;
          this.nextId += 1;
          el.setAttribute(EXACT_TARGET_ATTRIBUTE, id);
        }
        if (text && text.length < 80 && el.getAttribute("data-ai-text") !== text) {
          el.setAttribute("data-ai-text", text);
        }
        return ({
          id,
          kind: detectKind(el),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || "",
          type: el.getAttribute("type") || "",
          label: buildSemanticLabel(el),
          selector: stableSelector(el),
          exactSelector: `[${EXACT_TARGET_ATTRIBUTE}="${id}"]`,
          disabled: !!el.disabled,
          rect: el.getBoundingClientRect().toJSON()
        });
      });

      this.onUpdate?.({ elements: this.map, visibleText: visibleTextNodes.slice(0, 200) });
    }
  }

  function detectKind(el) {
    const tag = el.tagName.toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();

    if (tag === "button" || role === "button" || type === "button" || type === "submit" || type === "reset") return "button";
    if (tag === "a" || role === "link") return "link";
    if (tag === "input" || tag === "textarea" || role === "textbox" || el.getAttribute("contenteditable") === "true") {
      if (["checkbox", "radio"].includes(type)) return "toggle";
      return "input";
    }
    if (tag === "select" || ["combobox", "listbox", "option", "menu", "menuitem"].includes(role) || el.hasAttribute("aria-haspopup")) return "dropdown";
    if (["switch", "checkbox", "radio"].includes(role) || ["checkbox", "radio"].includes(type) || el.hasAttribute("aria-expanded")) return "toggle";
    if (["tab", "tabpanel"].includes(role)) return "tab";
    if (tag === "dialog" || role === "dialog") return "dialog";
    return "unknown";
  }

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  window.AIOperatorDOMScanner = { DOMScanner, detectKind };
})();
