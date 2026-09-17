import { readFileSync } from "node:fs";

const PLAN_PATH = "app/components/MasterSystemPlanV1.tsx";
const GENERATED_PATH = "app/generated-master-plan-test-ids.ts";
const GUARD_PATH = "app/components/TestPassGreenGuard.tsx";
const LAYOUT_PATH = "app/layout.tsx";
const SYNC_PATH = "app/components/VerifiedPlanEvidenceSync.tsx";
const PACKAGE_PATH = "package.json";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";

const PASS_RE = /\b(PASS|PASSED|SUCCESS|SUCCEEDED)\b/i;
const NON_PASS_RE = /\b(FAIL|FAILED|ERROR|PENDING|CANCELLED|CANCELED|BLOCKED)\b/i;

function hasPassingTestEvidence(value) {
  const evidence = String(value || "").trim();
  return Boolean(evidence && PASS_RE.test(evidence) && !NON_PASS_RE.test(evidence));
}

function parseRawPlan(source) {
  const startMarker = "const raw: RawPhase[] = ";
  const endMarker = "\n\nconst WAVE_LABELS";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error("unable to locate frozen raw plan");
  const literal = source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
  return Function(`\"use strict\"; return (${literal});`)();
}

function extractStringMap(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`missing map marker ${marker}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("\n};", open);
  if (open === -1 || close === -1) throw new Error(`unable to parse map ${marker}`);
  const body = source.slice(open + 1, close);
  const map = new Map();
  for (const match of body.matchAll(/"([0-9]+\.[0-9]+)"\s*:\s*"([^"]*)"/g)) map.set(match[1], match[2]);
  return map;
}

function selfTest() {
  const decide = (kind, requested, evidence) => {
    if (requested !== "green" || kind !== "test") return requested;
    return hasPassingTestEvidence(evidence) ? "green" : "yellow";
  };

  const cases = [
    ["test empty evidence rejected", decide("test", "green", ""), "yellow"],
    ["test whitespace evidence rejected", decide("test", "green", "   "), "yellow"],
    ["test pending evidence rejected", decide("test", "green", "run 42 PENDING"), "yellow"],
    ["test failed evidence rejected", decide("test", "green", "run 42 FAILED"), "yellow"],
    ["test ambiguous fail then pass rejected", decide("test", "green", "retry FAILED then PASS"), "yellow"],
    ["test PASS evidence accepted", decide("test", "green", "GitHub Actions run 42 PASS"), "green"],
    ["test SUCCESS evidence accepted", decide("test", "green", "CI conclusion SUCCESS"), "green"],
    ["core task not subject to test-pass gate", decide("core", "green", "commit abc123"), "green"],
    ["test yellow remains yellow", decide("test", "yellow", ""), "yellow"],
    ["test red remains red", decide("test", "red", ""), "red"],
  ];

  for (const [name, actual, expected] of cases) {
    if (actual !== expected) {
      console.error(`GREEN_TEST_PASS_SELF_TEST FAILED: ${name}: expected ${expected}, got ${actual}`);
      process.exit(1);
    }
  }
  console.log(`GREEN_TEST_PASS_SELF_TEST PASS: ${cases.length} policy cases verified.`);
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const planSource = readFileSync(PLAN_PATH, "utf8");
const generatedSource = readFileSync(GENERATED_PATH, "utf8");
const guardSource = readFileSync(GUARD_PATH, "utf8");
const layoutSource = readFileSync(LAYOUT_PATH, "utf8");
const syncSource = readFileSync(SYNC_PATH, "utf8");
const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
const workflowSource = readFileSync(WORKFLOW_PATH, "utf8");
const raw = parseRawPlan(planSource);

const expectedTestIds = [];
const defaultGreenTests = [];
for (const [phaseId, , items] of raw) {
  items.forEach((entry, index) => {
    const [, statusRaw, kindRaw] = String(entry).split("|");
    const id = `${phaseId}.${String(index + 1).padStart(2, "0")}`;
    if (kindRaw === "test") {
      expectedTestIds.push(id);
      if (statusRaw === "green") defaultGreenTests.push(id);
    }
  });
}

const generatedMatch = generatedSource.match(/MASTER_TEST_TASK_IDS\s*=\s*(\[[\s\S]*\])\s+as const;/);
if (!generatedMatch) {
  console.error("GREEN_TEST_PASS FAILED: generated test ID registry is missing or malformed.");
  process.exit(1);
}
const generatedTestIds = JSON.parse(generatedMatch[1]);
if (JSON.stringify(generatedTestIds) !== JSON.stringify(expectedTestIds)) {
  console.error("GREEN_TEST_PASS FAILED: generated test ID registry does not match frozen plan.");
  console.error(`Expected ${expectedTestIds.length} IDs, generated ${generatedTestIds.length}.`);
  process.exit(1);
}

const verifiedEvidence = extractStringMap(planSource, "const VERIFIED_EVIDENCE");
for (const id of defaultGreenTests) {
  if (!hasPassingTestEvidence(verifiedEvidence.get(id))) {
    console.error(`GREEN_TEST_PASS FAILED: default GREEN test task ${id} lacks PASS/SUCCESS evidence.`);
    process.exit(1);
  }
}

const verifiedWave = extractStringMap(syncSource, "const VERIFIED_WAVE_0");
const testIdSet = new Set(expectedTestIds);
for (const [id, evidence] of verifiedWave) {
  if (testIdSet.has(id) && !hasPassingTestEvidence(evidence)) {
    console.error(`GREEN_TEST_PASS FAILED: verified GREEN test task ${id} lacks passing test evidence.`);
    process.exit(1);
  }
}

const runtimeChecks = [
  [guardSource.includes("MASTER_TEST_TASK_IDS"), "runtime guard must consume generated frozen test IDs"],
  [guardSource.includes("PASS_RE"), "runtime guard must require explicit passing evidence"],
  [guardSource.includes("NON_PASS_RE"), "runtime guard must reject failing/pending evidence"],
  [guardSource.includes('nextStatuses[id] = "yellow"'), "runtime guard must downgrade invalid test GREEN to YELLOW"],
  [guardSource.includes("test task изисква PASS/SUCCESS evidence"), "runtime guard must expose a clear blocker"],
  [layoutSource.includes('import TestPassGreenGuard from "./components/TestPassGreenGuard"'), "root layout must import TestPassGreenGuard"],
  [layoutSource.includes("<TestPassGreenGuard />"), "root layout must mount TestPassGreenGuard"],
  [packageJson.scripts?.prebuild === "node scripts/generate-master-test-task-ids.mjs", "prebuild must regenerate test task IDs"],
  [workflowSource.includes("Generate frozen test task registry"), "CI must generate test task registry before verification"],
  [workflowSource.includes("GREEN passing-test invariant"), "CI must verify passing-test invariant"],
  [workflowSource.includes("GREEN passing-test rejection tests"), "CI must run passing-test self-tests"],
];
for (const [ok, message] of runtimeChecks) {
  if (!ok) {
    console.error(`GREEN_TEST_PASS FAILED: ${message}.`);
    process.exit(1);
  }
}

console.log(`GREEN_TEST_PASS PASS: ${expectedTestIds.length} frozen test tasks governed; runtime and CI enforcement present.`);
