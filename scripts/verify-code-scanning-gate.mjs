import { readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/code-scan.yml";
const PIN = "977e6ceaea7361825998245d787fa3b4d6b9e5df";
const workflow = readFileSync(WORKFLOW, "utf8");

const required = [
  "name: Code Scan",
  "security-events: write",
  "contents: read",
  `github/codeql-action/init@${PIN}`,
  `github/codeql-action/analyze@${PIN}`,
  "languages: javascript-typescript"
];

const missing = required.filter((entry) => !workflow.includes(entry));
if (missing.length) {
  console.error("26.11 CODE_SCAN_CONFIG FAIL", missing);
  process.exit(1);
}

if (workflow.includes("github/codeql-action/init@v") || workflow.includes("github/codeql-action/analyze@v")) {
  console.error("26.11 CODE_SCAN_CONFIG FAIL floating CodeQL action ref");
  process.exit(1);
}

console.log("26.11 CODE_SCAN_CONFIG PASS");
