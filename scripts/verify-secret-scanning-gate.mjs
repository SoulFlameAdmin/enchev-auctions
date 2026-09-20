import { readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/verify-enchev-web.yml";
const PIN = "trufflesecurity/trufflehog@f714bf454f350590f4a24c3ddb1aef02c35bf5b6";
const VERSION = "3.97.5";

export function verifyWorkflow(text) {
  const failures = [];
  if (!text.includes("fetch-depth: 0")) failures.push("checkout must fetch full git history");
  if (!text.includes("name: Secret scanning gate (26.10)")) failures.push("26.10 CI step missing");
  if (!text.includes(`uses: ${PIN}`)) failures.push("TruffleHog action is not pinned to the approved upstream commit");
  if (!text.includes(`version: '${VERSION}'`)) failures.push("TruffleHog scanner image version is not pinned");
  if (!text.includes("permissions:\n  contents: read")) failures.push("workflow must retain read-only contents permission");
  return failures;
}

function runSelfTest() {
  const valid = [
    "permissions:",
    "  contents: read",
    "steps:",
    "  - uses: actions/checkout@v4",
    "    with:",
    "      fetch-depth: 0",
    "  - name: Secret scanning gate (26.10)",
    `    uses: ${PIN}`,
    "    with:",
    `      version: '${VERSION}'`
  ].join("\n");

  const cases = [
    ["valid", valid, true],
    ["shallow-checkout", valid.replace("fetch-depth: 0", "fetch-depth: 1"), false],
    ["floating-action", valid.replace(PIN, "trufflesecurity/trufflehog@main"), false],
    ["floating-version", valid.replace(`version: '${VERSION}'`, "version: 'latest'"), false],
    ["missing-step", valid.replace("name: Secret scanning gate (26.10)", "name: Other gate"), false]
  ];

  for (const [name, sample, expectedPass] of cases) {
    const pass = verifyWorkflow(sample).length === 0;
    if (pass !== expectedPass) {
      throw new Error(`SECRET_SCANNING_GATE SELF_TEST FAIL case=${name}`);
    }
  }
  console.log("SECRET_SCANNING_GATE SELF_TEST PASS cases=5");
}

function run() {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const failures = verifyWorkflow(workflow);
  if (failures.length) {
    for (const failure of failures) console.error(`SECRET_SCANNING_GATE FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`SECRET_SCANNING_GATE PASS provider=TruffleHog version=${VERSION} pinned=true history=full`);
}

if (process.argv.includes("--self-test")) runSelfTest();
else run();
