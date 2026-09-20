import { readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/secret-scan.yml";
const PIN = "trufflesecurity/trufflehog@f714bf454f350590f4a24c3ddb1aef02c35bf5b6";
const VERSION = "3.97.5";

export function verifyWorkflow(text) {
  const failures = [];
  if (!text.includes("pull_request:")) failures.push("pull_request trigger missing");
  if (!text.includes("push:")) failures.push("push trigger missing");
  if (!text.includes("branches: [main]")) failures.push("main branch scope missing");
  if (!text.includes("contents: read")) failures.push("read-only contents permission missing");
  if (!text.includes("fetch-depth: 0")) failures.push("full git history checkout missing");
  if (!text.includes(`uses: ${PIN}`)) failures.push("scanner action pin mismatch");
  if (!text.includes(`version: '${VERSION}'`)) failures.push("scanner runtime version mismatch");
  return failures;
}

function runSelfTest() {
  const valid = [
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    branches: [main]",
    "permissions:",
    "  contents: read",
    "steps:",
    "  - with:",
    "      fetch-depth: 0",
    `  - uses: ${PIN}`,
    "    with:",
    `      version: '${VERSION}'`
  ].join("\n");

  const mutations = [
    valid.replace("fetch-depth: 0", "fetch-depth: 1"),
    valid.replace(PIN, "trufflesecurity/trufflehog@main"),
    valid.replace(`version: '${VERSION}'`, "version: 'latest'"),
    valid.replace("contents: read", "contents: write"),
    valid.replace(" --fail", "")
  ];

  if (verifyWorkflow(valid).length !== 0) throw new Error("26.10 SELF_TEST valid fixture rejected");
  for (const sample of mutations) {
    if (verifyWorkflow(sample).length === 0) throw new Error("26.10 SELF_TEST unsafe mutation accepted");
  }
  console.log("26.10 SECRET_SCAN_CONFIG SELF_TEST PASS cases=6");
}

const workflow = readFileSync(WORKFLOW, "utf8");
const failures = verifyWorkflow(workflow);
if (failures.length) {
  for (const failure of failures) console.error(`26.10 SECRET_SCAN_CONFIG FAIL: ${failure}`);
  process.exit(1);
}
console.log(`26.10 SECRET_SCAN_CONFIG PASS provider=TruffleHog version=${VERSION}`);
if (process.argv.includes("--self-test")) runSelfTest();
