import fs from "node:fs";

const PACKAGE_PATH = "package.json";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";

function fail(message) {
  throw new Error(`CI_QUALITY_GATES FAIL: ${message}`);
}

export function validateCiContract(pkg, workflow) {
  const expectedScripts = {
    lint: "node scripts/lint-repository.mjs",
    typecheck: "tsc --noEmit",
    test: "node scripts/verify-production-smoke-suite.mjs --self-test && node scripts/run-ci-tests.mjs",
    "ci:verify": "npm run lint && npm test && npm run typecheck && npm run build"
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (pkg.scripts?.[name] !== command) fail(`package script ${name} drift`);
  }

  const markers = [
    "- name: Repository lint\n        run: npm run lint",
    "- name: CI quality gate contract\n        run: node scripts/verify-ci-quality-gates.mjs",
    "- name: CI test suite\n        run: npm test",
    "- name: TypeScript check\n        run: npm run typecheck",
    "- name: Production build\n        run: npm run build"
  ];
  for (const marker of markers) {
    if (!workflow.includes(marker)) fail(`workflow marker missing: ${marker.split("\n")[0]}`);
  }

  if (!workflow.includes("pull_request:\n    branches: [main]")) fail("pull_request verification must stay enabled");
  if (!workflow.includes("push:\n    branches: [main]")) fail("main push verification must stay enabled");
  if (!workflow.includes("cancel-in-progress: true")) fail("CI concurrency protection must stay enabled");

  return true;
}

function expectRejected(label, fn) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
validateCiContract(pkg, workflow);

if (process.argv.includes("--self-test")) {
  expectRejected("missing lint script", () => validateCiContract({ ...pkg, scripts: { ...pkg.scripts, lint: "echo skipped" } }, workflow));
  expectRejected("missing test lane", () => validateCiContract(pkg, workflow.replace("- name: CI test suite", "- name: CI tests removed")));
  expectRejected("typecheck bypass", () => validateCiContract({ ...pkg, scripts: { ...pkg.scripts, typecheck: "echo skipped" } }, workflow));
  expectRejected("build bypass", () => validateCiContract({ ...pkg, scripts: { ...pkg.scripts, "ci:verify": "npm run lint && npm test" } }, workflow));
  expectRejected("PR verification removed", () => validateCiContract(pkg, workflow.replace("pull_request:\n    branches: [main]", "workflow_dispatch:")));
  console.log("CI_QUALITY_GATES_SELF_TEST PASS negative_cases=5");
} else {
  console.log("CI_QUALITY_GATES PASS lanes=lint,test,typecheck,build triggers=push+pull_request");
}
