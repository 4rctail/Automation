import { EventEmitter } from 'node:events';
import { chromium } from 'playwright';
import { makeId, normalizeEndpoint, serializeError, wait } from './utils.js';

/**
 * BrowserWorker owns exactly one remote Chromium-family browser connection.
 * It never launches extensions or opens DevTools. All control flows through
 * Playwright's CDP transport, which works with existing Edge/Brave/AdsPower
 * instances that were started with a remote debugging endpoint.
 */
export class BrowserWorker extends EventEmitter {
  constructor({
    browserId = makeId('browser'),
    type = 'chromium',
    endpoint,
    reconnect = true,
    reconnectDelayMs = 2000
  }) {
    super();
    this.browserId = browserId;
    this.type = type;
    this.endpoint = normalizeEndpoint(endpoint);
    this.reconnect = reconnect;
    this.reconnectDelayMs = reconnectDelayMs;
    this.browser = null;
    this.connected = false;
    this.connecting = null;
    this.closed = false;
    this.pages = new Map();
    this.consoleBuffer = [];
    this.maxConsoleEntries = 1000;
  }

  async connect() {
    if (this.connecting) return this.connecting;

    this.closed = false;
    this.connecting = this.#connectOnce()
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  async #connectOnce() {
    this.browser = await chromium.connectOverCDP(this.endpoint);
    this.connected = true;
    this.browser.on('disconnected', () => this.#handleDisconnect());
    await this.discoverTabs();
    this.emit('connected', this.snapshot());
    return this;
  }

  async disconnect() {
    this.closed = true;
    this.connected = false;
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
    }
    this.pages.clear();
  }

  #handleDisconnect() {
    this.connected = false;
    this.browser = null;
    this.pages.clear();
    this.emit('disconnected', this.snapshot());

    if (this.reconnect && !this.closed) {
      void this.#reconnectLoop();
    }
  }

  async #reconnectLoop() {
    while (this.reconnect && !this.closed && !this.connected) {
      try {
        await wait(this.reconnectDelayMs);
        await this.connect();
      } catch (error) {
        this.emit('reconnectFailed', {
          browserId: this.browserId,
          error: serializeError(error)
        });
      }
    }
  }

  async discoverTabs() {
    this.#assertConnected();

    for (const context of this.browser.contexts()) {
      context.on('page', (page) => this.#registerPage(context, page));
      for (const page of context.pages()) {
        this.#registerPage(context, page);
      }
    }

    this.emit('tabsChanged', this.snapshot());
    return this.listTabs();
  }

  #registerPage(context, page) {
    const existing = [...this.pages.values()].find((entry) => entry.page === page);
    if (existing) return existing;

    const tabId = makeId('tab');
    const entry = {
      tabId,
      contextId: this.#contextId(context),
      page,
      createdAt: new Date().toISOString()
    };

    this.pages.set(tabId, entry);
    page.on('console', (message) => this.#captureConsole(tabId, message));
    page.on('close', () => {
      this.pages.delete(tabId);
      this.emit('tabsChanged', this.snapshot());
    });
    page.on('crash', () => {
      this.emit('pageCrashed', { browserId: this.browserId, tabId });
    });
    return entry;
  }

  #contextId(context) {
    if (!context.__orchestratorContextId) {
      context.__orchestratorContextId = makeId('context');
    }
    return context.__orchestratorContextId;
  }

  #captureConsole(tabId, message) {
    const entry = {
      browserId: this.browserId,
      tabId,
      type: message.type(),
      text: message.text(),
      location: message.location(),
      timestamp: new Date().toISOString()
    };

    this.consoleBuffer.push(entry);
    if (this.consoleBuffer.length > this.maxConsoleEntries) {
      this.consoleBuffer.shift();
    }
    this.emit('console', entry);
  }

  listTabs() {
    return [...this.pages.values()].map(({ tabId, contextId, page, createdAt }) => ({
      browserId: this.browserId,
      tabId,
      contextId,
      url: safeSync(() => page.url(), ''),
      title: undefined,
      closed: safeSync(() => page.isClosed(), true),
      createdAt
    }));
  }

  async describeTab(tabId) {
    const entry = this.#getLivePage(tabId);
    return {
      browserId: this.browserId,
      tabId,
      contextId: entry.contextId,
      url: entry.page.url(),
      title: await entry.page.title().catch(() => ''),
      closed: entry.page.isClosed(),
      createdAt: entry.createdAt
    };
  }

  getConsoleEntries({ tabId, limit = 100 } = {}) {
    return this.consoleBuffer
      .filter((entry) => !tabId || entry.tabId === tabId)
      .slice(-limit);
  }

  async execute(tabId, command) {
    const entry = this.#getLivePage(tabId);
    const page = entry.page;
    const { action, params = {} } = command;

    switch (action) {
      case 'getTitle':
        return { value: await page.title() };
      case 'evaluate':
      case 'console':
        return this.#runtimeEvaluate(page, params.expression, params);
      case 'injectJs':
        return this.#runtimeEvaluate(page, params.source, {
          awaitPromise: true,
          returnByValue: true
        });
      case 'modifyDom':
        return this.#runtimeEvaluate(page, `(() => { ${params.script} })()`, {
          awaitPromise: true,
          returnByValue: true
        });
      case 'click':
        await page.locator(params.selector).click({ timeout: params.timeoutMs ?? 5000 });
        return { value: true };
      case 'localStorage':
        return this.#runtimeEvaluate(page, 'Object.fromEntries(Object.entries(localStorage))', {
          returnByValue: true
        });
      case 'fetch':
        return this.#runtimeEvaluate(page, buildFetchExpression(params), {
          awaitPromise: true,
          returnByValue: true
        });
      default:
        throw new Error(`Unsupported command action: ${action}`);
    }
  }

  async #runtimeEvaluate(page, expression, options = {}) {
    if (!expression || typeof expression !== 'string') {
      throw new Error('Runtime evaluation requires a string expression');
    }

    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Runtime.enable');
      const result = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: options.awaitPromise ?? true,
        returnByValue: options.returnByValue ?? true,
        userGesture: options.userGesture ?? true,
        replMode: options.replMode ?? true,
        timeout: options.timeoutMs
      });

      if (result.exceptionDetails) {
        const description = result.exceptionDetails.exception?.description
          ?? result.exceptionDetails.text;
        throw new Error(description);
      }

      return {
        value: result.result.value,
        type: result.result.type,
        subtype: result.result.subtype,
        description: result.result.description
      };
    } finally {
      await session.detach().catch(() => undefined);
    }
  }

  #getLivePage(tabId) {
    this.#assertConnected();
    const entry = this.pages.get(tabId);
    if (!entry || entry.page.isClosed()) {
      this.pages.delete(tabId);
      throw new Error(`Stale or unknown tab: ${tabId}. Refresh tab discovery and retry.`);
    }
    return entry;
  }

  #assertConnected() {
    if (!this.connected || !this.browser) {
      throw new Error(`Browser ${this.browserId} is not connected`);
    }
  }

  snapshot() {
    return {
      browserId: this.browserId,
      type: this.type,
      endpoint: this.endpoint,
      connected: this.connected,
      contexts: this.browser?.contexts().length ?? 0,
      tabs: this.listTabs()
    };
  }
}

function buildFetchExpression({ url, options = {}, responseType = 'json' }) {
  if (!url) throw new Error('fetch command requires params.url');
  const bodyReader = responseType === 'text' ? 'text()' : responseType === 'arrayBuffer' ? 'arrayBuffer()' : 'json().catch(() => r.text())';
  return `(async () => {
    const r = await fetch(${JSON.stringify(url)}, ${JSON.stringify(options)});
    return {
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
      body: await r.${bodyReader}
    };
  })()`;
}

function safeSync(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
