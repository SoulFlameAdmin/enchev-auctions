import fs from "node:fs";
import { spawnSync } from "node:child_process";

const CONFIG_PATH = "config/enchev-phase32-completion.json";
const MASTER_PATH = "app/components/MasterSystemPlanV1.tsx";

function fail(message) {
  throw new Error(`PHASE32_COMPLETION FAIL: ${message}`);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function frozenTaskMap() {
  const source = fs.readFileSync(MASTER_PATH, "utf8");
  const startMarker = "const raw: RawPhase[] = ";
  const endMarker = "\n\nconst WAVE_LABELS";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) fail("unable to locate frozen raw master plan");
  const literal = source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
  const raw = Function(`"use strict"; return (${literal});`)();
  const map = new Map();
  for (const [phaseId, , items] of raw) {
    items.forEach((entry, index) => {
      const [label] = String(entry).split("|");
      map.set(`${phaseId}.${String(index + 1).padStart(2, "0")}`, label);
    });
  }
  return map;
}

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0) {
    fail(`${script} ${args.join(" ")} failed: ${output.trim()}`);
  }
  return output;
}

const expectedTokens = {
  "32.04": ["GREEN_TEST_PASS PASS:", "GREEN_TEST_PASS_SELF_TEST PASS:"],
  "32.05": ["YELLOW_SEMANTICS_GUARD PASS:", "YELLOW_SEMANTICS_SELF_TEST PASS:"],
  "32.06": ["RED_SEMANTICS_GUARD PASS:", "RED_SEMANTICS_SELF_TEST PASS:"],
  "32.07": ["GAP_APPEND_ONLY_GUARD PASS:", "GAP_APPEND_ONLY_SELF_TEST PASS:"],
  "32.08": ["STATUS_AUDIT_GUARD PASS", "STATUS_AUDIT_SELF_TEST PASS"],
  "32.09": ["CLOUD_PLAN_STATE invariant PASS", "CLOUD_PLAN_STATE SELF-TEST PASS:"],
  "32.10": ["PLAN_VERSION_UI PASS", "PLAN_VERSION_UI_SELF_TEST PASS"]
};

function verifyTaskIdentity(config) {
  const frozen = frozenTaskMap();
  const expectedIds = ["32.04","32.05","32.06","32.07","32.08","32.09","32.10"];
  const actualIds = config.tasks?.map((task) => task.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    fail("completion contract must contain exactly frozen tasks 32.04-32.10 in order");
  }
  for (const task of config.tasks) {
    if (frozen.get(task.id) !== task.name) {
      fail(`frozen task identity drift for ${task.id}: expected "${task.name}", got "${frozen.get(task.id)}"`);
    }
  }
}

function verifyCanonicalGuards(config) {
  const results = [];
  for (const task of config.tasks) {
    if (!fs.existsSync(task.verifier)) fail(`${task.id} verifier missing: ${task.verifier}`);
    const invariant = run(task.verifier);
    const selfTest = run(task.verifier, ["--self-test"]);
    const [invariantToken, selfToken] = expectedTokens[task.id] || [];
    if (!invariantToken || !invariant.includes(invariantToken)) {
      fail(`${task.id} invariant PASS token missing`);
    }
    if (!selfToken || !selfTest.includes(selfToken)) {
      fail(`${task.id} self-test PASS token missing`);
    }
    results.push({ id: task.id, invariant: true, selfTest: true, output: invariant });
  }
  return results;
}

function verifySpecificSemantics(config, results) {
  const byId = new Map(results.map((result) => [result.id, result.output]));

  const greenPass = byId.get("32.04") || "";
  const countMatch = greenPass.match(/GREEN_TEST_PASS PASS:\s+(\d+)\s+frozen\+expansion test tasks governed/);
  if (!countMatch) fail("32.04 governed test task count missing");
  const testTasks = Number(countMatch[1]);
  if (testTasks < config.expected.minimumFrozenAndExpansionTestTasks) {
    fail(`32.04 governed test tasks regressed: ${testTasks}`);
  }

  if (!byId.get("32.05")?.includes("YELLOW remains partial/error/pending verification")) {
    fail("32.05 YELLOW semantics drift");
  }
  if (!byId.get("32.06")?.includes("RED remains not implemented")) {
    fail("32.06 RED semantics drift");
  }
  if (!byId.get("32.07")?.includes("GAP-001..094 are permanent") ||
      !byId.get("32.07")?.includes("GAP-095+")) {
    fail("32.07 append-only GAP semantics drift");
  }
  if (!byId.get("32.08")?.includes("STATUS_AUDIT_GUARD PASS")) {
    fail("32.08 audit guard drift");
  }
  if (!byId.get("32.09")?.includes("verified_rows=")) {
    fail("32.09 cloud verified-row projection missing");
  }
  if (!byId.get("32.10")?.includes(`version=${config.expected.planVersion}`)) {
    fail("32.10 displayed plan version drift");
  }

  return { testTasks };
}

const config = readJson(CONFIG_PATH);
if (config.phaseId !== "32" || config.phaseName !== "Master plan governance") {
  fail("phase identity mismatch");
}
if (config.requirements?.preserveCanonicalImplementations !== true ||
    config.requirements?.addParallelGovernanceImplementation !== false) {
  fail("Phase 32 completion must reuse canonical governance implementations");
}

verifyTaskIdentity(config);
const results = verifyCanonicalGuards(config);
const summary = verifySpecificSemantics(config, results);

if (process.argv.includes("--self-test")) {
  const cases = [];
  const expectRejected = (label, action) => {
    let rejected = false;
    try { action(); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases.push(label);
  };

  expectRejected("task order drift", () => {
    const mutated = structuredClone(config);
    [mutated.tasks[0], mutated.tasks[1]] = [mutated.tasks[1], mutated.tasks[0]];
    verifyTaskIdentity(mutated);
  });

  expectRejected("task label drift", () => {
    const mutated = structuredClone(config);
    mutated.tasks[3].name = "Mutable GAP IDs";
    verifyTaskIdentity(mutated);
  });

  expectRejected("missing canonical verifier", () => {
    const mutated = structuredClone(config);
    mutated.tasks[4].verifier = "scripts/does-not-exist.mjs";
    verifyCanonicalGuards(mutated);
  });

  expectRejected("plan version drift", () => {
    const mutated = structuredClone(config);
    mutated.expected.planVersion = "2.0";
    verifySpecificSemantics(mutated, results);
  });

  expectRejected("test-governance minimum drift", () => {
    const mutated = structuredClone(config);
    mutated.expected.minimumFrozenAndExpansionTestTasks = summary.testTasks + 1;
    verifySpecificSemantics(mutated, results);
  });

  console.log(`PHASE32_COMPLETION_SELF_TEST PASS cases=${cases.length} remaining_tasks=7 governed_test_tasks=${summary.testTasks}`);
} else {
  console.log(`PHASE32_COMPLETION PASS remaining_tasks=7 phase32_total=10 governed_test_tasks=${summary.testTasks} yellow_semantics=true red_semantics=true append_only_gaps=true audit_trail=true cloud_realtime_store=true plan_version=${config.expected.planVersion}`);
}
