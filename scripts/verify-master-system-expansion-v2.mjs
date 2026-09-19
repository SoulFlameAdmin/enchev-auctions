import { readFileSync } from "node:fs";

const PARTS = [1,2,3,4].map((n) => `app/master-system-expansion-v2/part-${n}.json`);
const EXPECTED_PHASE_COUNT = 38;
const EXPECTED_TASK_COUNT = 3226;
const EXPECTED_FIRST_PHASE = 62;
const EXPECTED_LAST_PHASE = 99;
const EXPECTED_FNV1A32 = "e7c9cf20";
const VALID_KINDS = new Set(["core","test","security","legal","global","ai"]);
const VALID_STATUS = new Set(["red","yellow","green"]);

function fail(message) { throw new Error(`MASTER_EXPANSION_V2 FAIL: ${message}`); }

function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function loadParts() {
  return PARTS.map((path, index) => {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed.version !== "2.0 APPEND-ONLY") fail(`${path}: wrong version`);
    if (parsed.part !== index + 1) fail(`${path}: wrong part number`);
    if (!Array.isArray(parsed.phases)) fail(`${path}: phases must be an array`);
    return parsed;
  });
}

function inspect(parts) {
  const phases = parts.flatMap((part) => part.phases);
  const ids = phases.map((p) => Number(p.id));
  const expectedIds = Array.from({ length: EXPECTED_PHASE_COUNT }, (_, i) => EXPECTED_FIRST_PHASE + i);
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) fail("phase IDs/order must be exactly 62 -> 99");

  const phaseSeen = new Set();
  const taskSeen = new Set();
  const labelSeenPerPhase = new Map();
  const records = [];
  let taskCount = 0;
  let testCount = 0;
  const kindCounts = {};

  for (const phase of phases) {
    if (phaseSeen.has(phase.id)) fail(`duplicate phase ${phase.id}`);
    phaseSeen.add(phase.id);
    if (!String(phase.title || "").trim()) fail(`${phase.id}: missing title`);
    if (!Number.isInteger(phase.wave) || phase.wave < 0 || phase.wave > 14) fail(`${phase.id}: invalid wave`);
    if (!Array.isArray(phase.dependsOn)) fail(`${phase.id}: dependsOn must be an array`);
    for (const dep of phase.dependsOn) {
      if (!/^\\d{2}$/.test(String(dep))) fail(`${phase.id}: invalid dependency ${dep}`);
      if (String(dep) === String(phase.id)) fail(`${phase.id}: self dependency is forbidden`);
      const depNum = Number(dep);
      if (depNum > EXPECTED_LAST_PHASE) fail(`${phase.id}: dependency ${dep} is outside known phase range`);
    }
    if (!Array.isArray(phase.tasks) || phase.tasks.length < 60 || phase.tasks.length > 99) fail(`${phase.id}: expected 60-99 tasks, got ${phase.tasks?.length}`);

    const localLabels = new Set();
    labelSeenPerPhase.set(phase.id, localLabels);

    phase.tasks.forEach((task, index) => {
      const taskId = `${phase.id}.${String(index + 1).padStart(2, "0")}`;
      if (taskSeen.has(taskId)) fail(`duplicate task ID ${taskId}`);
      taskSeen.add(taskId);
      const label = String(task.label || "").trim();
      if (!label) fail(`${taskId}: missing label`);
      const normalized = label.toLowerCase();
      if (localLabels.has(normalized)) fail(`${taskId}: duplicate label within phase`);
      localLabels.add(normalized);
      if (!VALID_KINDS.has(task.kind)) fail(`${taskId}: invalid kind ${task.kind}`);
      if (!VALID_STATUS.has(task.defaultStatus)) fail(`${taskId}: invalid defaultStatus`);
      if (task.defaultStatus !== "red") fail(`${taskId}: expansion tasks must start RED; GREEN requires real evidence`);
      kindCounts[task.kind] = (kindCounts[task.kind] || 0) + 1;
      if (task.kind === "test") testCount += 1;
      taskCount += 1;
      records.push(`${phase.id}|${phase.wave}|${phase.dependsOn.join(",")}|${phase.title}|${taskId}|${label}|${task.kind}`);
    });
  }

  const digest = fnv1a32(records.join("\n"));
  return { phases, taskCount, testCount, kindCounts, digest };
}

function verifyDependencyGraph(phases) {
  const master = readFileSync("app/components/MasterSystemPlanV1.tsx", "utf8");
  const mapStart = master.indexOf("const PHASE_WAVE");
  const mapEnd = master.indexOf("const frozenPhases", mapStart);
  const block = master.slice(mapStart, mapEnd);
  const waveMap = {};
  for (const match of block.matchAll(/"(\\d{2})":(\\d+)/g)) waveMap[match[1]] = Number(match[2]);
  for (const phase of phases) waveMap[String(phase.id)] = Number(phase.wave);

  for (const phase of phases) {
    for (const dep of phase.dependsOn || []) {
      if (!(String(dep) in waveMap)) fail(`${phase.id}: dependency ${dep} has no known phase`);
      if (waveMap[String(dep)] > phase.wave) fail(`${phase.id}: dependency ${dep} is in later wave ${waveMap[String(dep)]}`);
    }
  }

  const graph = new Map(phases.map((phase) => [
    String(phase.id),
    (phase.dependsOn || []).map(String).filter((id) => Number(id) >= EXPECTED_FIRST_PHASE),
  ]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id, stack = []) => {
    if (visiting.has(id)) fail(`dependency cycle: ${[...stack, id].join(" -> ")}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) || []) visit(dep, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const phase of phases) visit(String(phase.id));
}

function verifyIntegration() {
  const source = readFileSync("app/components/MasterSystemPlanV1.tsx", "utf8");
  const expansionDoc = readFileSync("docs/MASTER_SYSTEM_EXPANSION_V2.md", "utf8");
  const globalCommerce = readFileSync("docs/GLOBAL_COMMERCE_UX_SPEC_V1.md", "utf8");
  const designPlan = readFileSync("docs/DESIGN_PROCESS_2.md", "utf8");
  if (!expansionDoc.includes("4,280 system points")) fail("expansion source-of-truth must declare combined 4,280-point baseline");
  if (!expansionDoc.includes("FNV1a32 e7c9cf20")) fail("expansion source-of-truth digest mismatch");
  if (!expansionDoc.includes("phases 62–99")) fail("expansion source-of-truth must define phases 62-99");
  if (!globalCommerce.includes("GLOBAL COMMERCE UX SPEC V1")) fail("Global Commerce UX source missing");
  if (!designPlan.includes("GLOBAL_COMMERCE_UX_SPEC_V1.md")) fail("Design Process 2 must bind Global Commerce UX");
  if (designPlan.includes("Do not add pricing/payment/finance scope")) fail("obsolete DP2 commercial-scope ban still present");
  for (const n of [1,2,3,4]) {
    if (!source.includes(`master-system-expansion-v2/part-${n}.json`)) fail(`Command Center missing expansion part ${n}`);
  }
  if (!source.includes("const expansionPhases: Phase[]")) fail("Command Center expansion phase mapping missing");
  if (!source.includes("[...frozenPhases, ...expansionPhases]")) fail("frozen + expansion merge missing");
  if (!source.includes('const EXPANSION_VERSION = "2.0 APPEND-ONLY"')) fail("expansion version UI binding missing");
  if (!source.includes("dependsOn: Array.isArray(phase.dependsOn)")) fail("Command Center dependency graph mapping missing");
  if (!source.includes("...gaps].filter")) fail("FINAL 100% gate must include append-only GAP tasks");

  const worker = readFileSync("tools/david/auto-continue-enchev-v5.mjs", "utf8");
  if (!worker.includes("MASTER SYSTEM EXPANSION v2.0 APPEND-ONLY")) fail("SYSTEM worker does not know the expansion source");
  if (!worker.includes("dependsOn")) fail("SYSTEM worker must obey expansion dependency graph");
  if (worker.includes("не добавяй pricing/payment/finance")) fail("obsolete pricing/payment/finance ban still present");
  const designWorker = readFileSync("tools/david/auto-continue-design-v1.mjs", "utf8");
  if (!designWorker.includes("GLOBAL_COMMERCE_UX_SPEC_V1.md")) fail("DESIGN worker must consume Global Commerce UX spec");
  if (!designWorker.includes("MASTER_SYSTEM_EXPANSION_V2.md")) fail("DESIGN worker must consume company expansion rules");
  if (designWorker.includes("Не добавяй pricing/payment/finance scope")) fail("obsolete DESIGN worker commercial-scope ban still present");
}

function runSelfTest() {
  const good = loadParts();
  const baseline = inspect(good);
  if (baseline.taskCount !== EXPECTED_TASK_COUNT) fail("self-test baseline count mismatch");

  const changed = structuredClone(good);
  changed[0].phases[0].tasks[0].label += " changed";
  if (inspect(changed).digest === EXPECTED_FNV1A32) fail("identity mutation was not detected");

  const duplicate = structuredClone(good);
  duplicate[0].phases[0].tasks[1].label = duplicate[0].phases[0].tasks[0].label;
  let rejected = false;
  try { inspect(duplicate); } catch { rejected = true; }
  if (!rejected) fail("duplicate label mutation was not rejected");

  const preGreen = structuredClone(good);
  preGreen[0].phases[0].tasks[0].defaultStatus = "green";
  rejected = false;
  try { inspect(preGreen); } catch { rejected = true; }
  if (!rejected) fail("default GREEN mutation was not rejected");

  const cyc = structuredClone(good);
  const p62 = cyc.flatMap((part) => part.phases).find((p) => p.id === "62");
  const p63 = cyc.flatMap((part) => part.phases).find((p) => p.id === "63");
  p62.dependsOn = ["63"];
  p63.dependsOn = ["62"];
  rejected = false;
  try { verifyDependencyGraph(cyc.flatMap((part) => part.phases)); } catch { rejected = true; }
  if (!rejected) fail("dependency cycle mutation was not rejected");

  console.log("MASTER_EXPANSION_V2_SELF_TEST PASS identity=1 duplicate=1 pregreen=1 cycle=1");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const result = inspect(loadParts());
  if (result.taskCount !== EXPECTED_TASK_COUNT) fail(`expected ${EXPECTED_TASK_COUNT} tasks, got ${result.taskCount}`);
  if (result.phases.length !== EXPECTED_PHASE_COUNT) fail(`expected ${EXPECTED_PHASE_COUNT} phases`);
  if (result.digest !== EXPECTED_FNV1A32) fail(`identity digest changed: expected ${EXPECTED_FNV1A32}, got ${result.digest}`);
  if (result.testCount !== 965) fail(`expected 965 test tasks, got ${result.testCount}`);
  verifyDependencyGraph(result.phases);
  verifyIntegration();
  console.log(`MASTER_EXPANSION_V2 PASS phases=${result.phases.length} tasks=${result.taskCount} tests=${result.testCount} digest=${result.digest} dag=clean`);
}
