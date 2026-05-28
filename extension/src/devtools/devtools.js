chrome.devtools.panels.create(
  "AI Operator",
  "",
  "src/devtools/panel.html",
  (panel) => {
    // Keep this callback for future panel lifecycle wiring.
    console.info("AI Operator DevTools panel created.", panel);
  }
);
