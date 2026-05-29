const assert = require("assert");
const fs = require("fs");
const path = require("path");

const parserSource = fs.readFileSync(path.join(__dirname, "..", "src", "content", "prompt-parser.js"), "utf8");
global.window = {};
eval(parserSource);

const { parsePrompt } = global.window.AIOperatorPromptParser;

const cases = [
  {
    name: "click and wait chain",
    input: "Click Create and wait for GMV",
    expected: [
      { type: "click", target: "Create" },
      { type: "wait_text", value: "GMV" }
    ]
  },
  {
    name: "type into field",
    input: "Find Ad Name field and enter Summer Campaign",
    expected: [{ type: "type", target: "Ad Name", value: "Summer Campaign" }]
  },
  {
    name: "conditional retry",
    input: "If Something Went Wrong appears, retry",
    expected: [{ type: "if_text_click", value: "Something Went Wrong", target: "retry", timeoutMs: 5000 }]
  },
  {
    name: "select value in dropdown",
    input: "Select GMV in Objective",
    expected: [{ type: "select", target: "Objective", value: "GMV" }]
  },
  {
    name: "choose value from dropdown",
    input: "Choose GMV from Objective",
    expected: [{ type: "select", target: "Objective", value: "GMV" }]
  },
  {
    name: "set dropdown value",
    input: "Set Objective to GMV",
    expected: [{ type: "select", target: "Objective", value: "GMV" }]
  },
  {
    name: "multi-line instructions ignore comments",
    input: "# comment\nClick Create\nwait for GMV",
    expected: [
      { type: "click", target: "Create" },
      { type: "wait_text", value: "GMV" }
    ]
  },
  {
    name: "scroll up amount",
    input: "Scroll up 250",
    expected: [{ type: "scroll", px: -250 }]
  }
];

for (const testCase of cases) {
  assert.deepStrictEqual(parsePrompt(testCase.input), testCase.expected, testCase.name);
}

console.log(`prompt-parser: ${cases.length} cases passed`);
