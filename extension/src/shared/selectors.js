(() => {
  if (window.AIOperatorSelectorsLoaded) return;
  window.AIOperatorSelectorsLoaded = true;

  const SELECTOR_PRIORITY = [
    "data-testid",
    "aria-label",
    "role",
    "text",
    "name",
    "placeholder",
    "id"
  ];

  function buildSemanticLabel(el) {
    const parts = [
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder"),
      el.getAttribute("data-testid"),
      el.innerText?.trim(),
      nearbyLabel(el),
      el.getAttribute("name")
    ].filter(Boolean);
    return [...new Set(parts)].join(" | ").slice(0, 280);
  }

  function stableSelector(el) {
    if (el.dataset?.testid) return `[data-testid="${cssEscape(el.dataset.testid)}"]`;
    if (el.getAttribute("aria-label")) return `${el.tagName.toLowerCase()}[aria-label="${cssEscape(el.getAttribute("aria-label"))}"]`;
    if (el.getAttribute("role")) return `${el.tagName.toLowerCase()}[role="${cssEscape(el.getAttribute("role"))}"]`;
    if (el.id) return `#${cssEscape(el.id)}`;
    const text = (el.innerText || el.textContent || "").trim();
    if (text && text.length < 80) {
      const exactText = text.replace(/"/g, "\\\"");
      return `${el.tagName.toLowerCase()}[data-ai-text="${exactText}"]`;
    }
    return el.tagName.toLowerCase();
  }

  function nearbyLabel(el) {
    const label = el.closest("label") || document.querySelector(`label[for="${el.id}"]`);
    return label?.innerText?.trim() || "";
  }

  function cssEscape(value) {
    return CSS.escape(String(value));
  }

  window.AIOperatorSelectors = { SELECTOR_PRIORITY, buildSemanticLabel, stableSelector };
})();
