(() => {
  if (window.AIOperatorActionEngineLoaded) return;
  window.AIOperatorActionEngineLoaded = true;

  class ActionEngine {
    constructor({ scanner, logger, highlighter }) {
      this.scanner = scanner;
      this.logger = logger;
      this.highlighter = highlighter;
      this.queue = Promise.resolve();
    }

    enqueue(action) {
      this.queue = this.queue.then(() => this.execute(action)).catch((err) => this.logger(`Action failed: ${err.message}`));
      return this.queue;
    }

    async execute(action) {
      this.logger(`Running ${action.type}`);
      switch (action.type) {
        case "click": return this.retry(() => this.click(action.target));
        case "type": return this.retry(() => this.type(action.target, action.value));
        case "select": return this.retry(() => this.select(action.target, action.value));
        case "wait_text": return this.waitForText(action.value, action.timeoutMs || 15000);
        case "if_text_click": return this.ifTextClick(action.value, action.target, action.timeoutMs || 5000);
        case "scroll": return window.scrollBy({ top: action.px || 500, behavior: "smooth" });
        case "monitor": return this.monitor(action.target, action.expected, action.timeoutMs || 10000);
        default: this.logger(`Unknown action: ${action.type}`);
      }
    }

    findTarget(target) {
      const normalizedTarget = String(target || "").toLowerCase();
      const entry = this.scanner.map.find((e) => {
        const label = String(e.label || "").toLowerCase();
        const selector = String(e.selector || "");
        return label.includes(normalizedTarget)
          || selector === target
          || e.exactSelector === target
          || String(e.id || "").toLowerCase() === normalizedTarget;
      });
      if (!entry) throw new Error(`Target not found: ${target}`);
      const el = this.queryEntryElement(entry);
      if (!el) throw new Error(`Stale selector for: ${target}`);
      return el;
    }

    queryEntryElement(entry) {
      const selectors = [entry.exactSelector, entry.selector].filter(Boolean);
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          if (el) return el;
        } catch (err) {
          this.logger(`Ignoring invalid selector ${selector}: ${err.message}`);
        }
      }
      return null;
    }

    async click(target) {
      const el = this.findTarget(target);
      this.highlighter(el);
      el.click();
    }

    async type(target, value) {
      const el = this.findTarget(target);
      this.highlighter(el);
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    async select(target, value) {
      const el = this.findTarget(target);
      this.highlighter(el);
      if (el.tagName.toLowerCase() === "select") {
        const option = [...el.options].find((item) => {
          const desired = String(value || "").toLowerCase();
          return item.value.toLowerCase() === desired || item.textContent.trim().toLowerCase() === desired;
        });
        if (!option) throw new Error(`Option not found for ${target}: ${value}`);
        el.value = option.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      el.click();
    }

    async ifTextClick(text, target, timeoutMs) {
      const appeared = await this.hasTextWithin(text, timeoutMs);
      if (!appeared) {
        this.logger(`Condition text did not appear, skipping retry: ${text}`);
        return;
      }
      this.logger(`Condition text appeared, clicking ${target}.`);
      return this.retry(() => this.click(target));
    }

    waitForText(text, timeoutMs) {
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (document.body.innerText.includes(text)) {
            clearInterval(timer); resolve(true);
          } else if (Date.now() - started > timeoutMs) {
            clearInterval(timer); reject(new Error(`Timed out waiting for text: ${text}`));
          }
        }, 300);
      });
    }

    hasTextWithin(text, timeoutMs) {
      return new Promise((resolve) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (document.body.innerText.includes(text)) {
            clearInterval(timer); resolve(true);
          } else if (Date.now() - started > timeoutMs) {
            clearInterval(timer); resolve(false);
          }
        }, 300);
      });
    }

    monitor(target, expected, timeoutMs) {
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          const el = this.findTarget(target);
          const value = el.value ?? el.textContent;
          if (String(value).includes(expected)) {
            clearInterval(timer); resolve(true);
          } else if (Date.now() - started > timeoutMs) {
            clearInterval(timer); reject(new Error(`Monitor timeout for: ${target}`));
          }
        }, 300);
      });
    }

    async retry(fn, attempts = 3, delayMs = 600) {
      let err;
      for (let i = 0; i < attempts; i += 1) {
        try { return await fn(); } catch (e) { err = e; await new Promise((r) => setTimeout(r, delayMs)); }
      }
      throw err;
    }
  }

  window.AIOperatorActionEngine = { ActionEngine };
})();
