import { EventEmitter } from 'node:events';
import { BrowserWorker } from './browser-worker.js';
import { CommandQueue } from './command-queue.js';
import { makeId, serializeError } from './utils.js';

/**
 * CDPConnectionManager is the central registry. It keeps browser metadata,
 * forwards worker events, and serializes commands per tab while allowing many
 * browsers to be active at the same time.
 */
export class CDPConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
    this.queue = new CommandQueue();
  }

  async registerBrowser({ browserId = makeId('browser'), type = 'chromium', endpoint, reconnect = true }) {
    if (this.workers.has(browserId)) {
      throw new Error(`Browser already registered: ${browserId}`);
    }

    const worker = new BrowserWorker({ browserId, type, endpoint, reconnect });
    this.#wireWorker(worker);
    this.workers.set(browserId, worker);

    try {
      await worker.connect();
      return worker.snapshot();
    } catch (error) {
      this.workers.delete(browserId);
      throw error;
    }
  }

  async unregisterBrowser(browserId) {
    const worker = this.#getWorker(browserId);
    await worker.disconnect();
    this.workers.delete(browserId);
    return { browserId, removed: true };
  }

  async reconnectBrowser(browserId) {
    const worker = this.#getWorker(browserId);
    await worker.connect();
    return worker.snapshot();
  }

  listBrowsers() {
    return [...this.workers.values()].map((worker) => worker.snapshot());
  }

  async discoverTabs(browserId) {
    if (browserId) {
      return this.#getWorker(browserId).discoverTabs();
    }

    const results = [];
    for (const worker of this.workers.values()) {
      results.push(...await worker.discoverTabs().catch(() => []));
    }
    return results;
  }

  async listTabs() {
    const tabs = [];
    for (const worker of this.workers.values()) {
      for (const tab of worker.listTabs()) {
        tabs.push(tab);
      }
    }
    return tabs;
  }

  async describeTab(browserId, tabId) {
    return this.#getWorker(browserId).describeTab(tabId);
  }

  getConsoleEntries(browserId, options = {}) {
    return this.#getWorker(browserId).getConsoleEntries(options);
  }

  async execute(browserId, tabId, command) {
    const worker = this.#getWorker(browserId);
    const key = `${browserId}:${tabId}`;
    return this.queue.enqueue(key, async () => worker.execute(tabId, command));
  }

  #wireWorker(worker) {
    for (const eventName of ['connected', 'disconnected', 'tabsChanged', 'console', 'pageCrashed', 'reconnectFailed']) {
      worker.on(eventName, (payload) => this.emit(eventName, payload));
    }
    worker.on('reconnectFailed', (payload) => {
      this.emit('errorEvent', { ...payload, error: serializeError(payload.error) });
    });
  }

  #getWorker(browserId) {
    const worker = this.workers.get(browserId);
    if (!worker) throw new Error(`Unknown browser: ${browserId}`);
    return worker;
  }
}
