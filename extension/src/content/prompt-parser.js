function parsePrompt(prompt) {
  const p = prompt.trim();
  if (/^click\s+/i.test(p)) {
    const [, target] = p.match(/^click\s+(.+)/i) || [];
    return [{ type: "click", target }];
  }
  if (/enter\s+/i.test(p) || /type\s+/i.test(p)) {
    const m = p.match(/(?:find\s+)?(.+?)\s+(?:and\s+)?(?:enter|type)\s+(.+)/i);
    if (m) return [{ type: "type", target: m[1], value: m[2] }];
  }
  if (/wait\s+for\s+/i.test(p)) {
    const [, text] = p.match(/wait\s+for\s+(.+)/i) || [];
    return [{ type: "wait_text", value: text }];
  }
  if (/if\s+(.+)\s+appears,?\s*retry/i.test(p)) {
    const [, text] = p.match(/if\s+(.+)\s+appears,?\s*retry/i) || [];
    return [{ type: "wait_text", value: text, timeoutMs: 5000 }, { type: "click", target: "retry" }];
  }
  return [];
}

window.AIOperatorPromptParser = { parsePrompt };
