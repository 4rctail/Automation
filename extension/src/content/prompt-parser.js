(() => {
  if (window.AIOperatorPromptParserLoaded) return;
  window.AIOperatorPromptParserLoaded = true;

  function parsePrompt(prompt) {
    return splitInstructionLines(prompt).flatMap(parseInstructionLine).filter(Boolean);
  }

  function splitInstructionLines(prompt) {
    return String(prompt || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  function parseInstructionLine(line) {
    const p = line.trim();

    const conditionalRetry = p.match(/^if\s+(.+?)\s+appears,?\s*(?:then\s+)?retry$/i);
    if (conditionalRetry) {
      return [{ type: "if_text_click", value: conditionalRetry[1].trim(), target: "retry", timeoutMs: 5000 }];
    }

    const clickAndWait = p.match(/^click\s+(.+?)\s+(?:and\s+)?(?:then\s+)?wait\s+for\s+(.+)$/i);
    if (clickAndWait) {
      return [
        { type: "click", target: clickAndWait[1].trim() },
        { type: "wait_text", value: clickAndWait[2].trim() }
      ];
    }

    const chained = splitChainedInstruction(p);
    if (chained.length > 1) {
      return chained.flatMap(parseInstructionLine);
    }

    const click = p.match(/^click\s+(.+)$/i);
    if (click) return [{ type: "click", target: click[1].trim() }];

    const type = p.match(/^(?:find\s+)?(.+?)\s+(?:field\s+)?(?:and\s+)?(?:enter|type)\s+(.+)$/i);
    if (type) return [{ type: "type", target: cleanupTarget(type[1]), value: type[2].trim() }];

    const selectIn = p.match(/^(?:select|choose)\s+(.+?)\s+(?:in|from)\s+(.+)$/i);
    if (selectIn) return [{ type: "select", target: cleanupTarget(selectIn[2]), value: selectIn[1].trim() }];

    const setTo = p.match(/^set\s+(.+?)\s+to\s+(.+)$/i);
    if (setTo) return [{ type: "select", target: cleanupTarget(setTo[1]), value: setTo[2].trim() }];

    const wait = p.match(/^wait\s+for\s+(.+)$/i);
    if (wait) return [{ type: "wait_text", value: wait[1].trim() }];

    const scroll = p.match(/^scroll(?:\s+(down|up))?(?:\s+(\d+))?$/i);
    if (scroll) {
      const direction = (scroll[1] || "down").toLowerCase();
      const amount = Number(scroll[2] || 500);
      return [{ type: "scroll", px: direction === "up" ? -amount : amount }];
    }

    return [];
  }

  function splitChainedInstruction(line) {
    return line
      .split(/\s+(?:then|and then)\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function cleanupTarget(target) {
    return String(target || "")
      .replace(/\s+(?:field|input|dropdown|select|menu)$/i, "")
      .trim();
  }

  window.AIOperatorPromptParser = { parsePrompt };
})();
