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
      case "scroll": return window.scrollBy({ top: action.px || 500, behavior: "smooth" });
      case "monitor": return this.monitor(action.target, action.expected, action.timeoutMs || 10000);
      default: this.logger(`Unknown action: ${action.type}`);
    }
  }

  findTarget(target) {
    const entry = this.scanner.map.find((e) => e.label.toLowerCase().includes(target.toLowerCase()) || e.selector === target);
    if (!entry) throw new Error(`Target not found: ${target}`);
    const el = document.querySelector(entry.selector.startsWith("#") || entry.selector.includes("[") ? entry.selector : entry.tag);
    if (!el) throw new Error(`Stale selector for: ${target}`);
    return el;
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
    if (el.tagName.toLowerCase() === "select") {
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    el.click();
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
