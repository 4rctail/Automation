/**
 * Per-target FIFO command queues keep tab operations deterministic while still
 * allowing unrelated browsers/tabs to run in parallel. The queue stores only
 * promises and has no browser knowledge, so it can be reused by API and WS
 * callers without coupling transport concerns to orchestration logic.
 */
export class CommandQueue {
  constructor() {
    this.queues = new Map();
  }

  enqueue(key, task) {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key);
        }
      });

    this.queues.set(key, next);
    return next;
  }

  size() {
    return this.queues.size;
  }
}
