import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const PLAN_PATH = "app/components/MasterSystemPlanV1.tsx";
const source = readFileSync(PLAN_PATH, "utf8");
const startMarker = "const raw: RawPhase[] = ";
const endMarker = "\n\nconst WAVE_LABELS";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  console.error("MASTER_ID_LOCK: unable to locate frozen raw plan in MasterSystemPlanV1.tsx");
  process.exit(1);
}

const literal = source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
let raw;
try {
  raw = Function(`\"use strict\"; return (${literal});`)();
} catch (error) {
  console.error("MASTER_ID_LOCK: unable to parse frozen raw plan", error);
  process.exit(1);
}

if (!Array.isArray(raw)) {
  console.error("MASTER_ID_LOCK: frozen raw plan is not an array");
  process.exit(1);
}

const records = [];
for (const phase of raw) {
  if (!Array.isArray(phase) || phase.length !== 3 || !Array.isArray(phase[2])) {
    console.error("MASTER_ID_LOCK: malformed phase entry");
    process.exit(1);
  }
  const [phaseId, phaseTitle, items] = phase;
  items.forEach((entry, index) => {
    const [label] = String(entry).split("|");
    const taskId = `${phaseId}.${String(index + 1).padStart(2, "0")}`;
    records.push(`${taskId}|${phaseTitle}|${label}`);
  });
}

// MASTER SYSTEM PLAN v1.0 FROZEN identity lock.
// Changing this baseline is a governance event, never a routine edit.
const EXPECTED_TASK_COUNT = 1054;
const EXPECTED_SHA256 = "b0fd3479cfef3d88148b906568aa8c1c88eccf5fa98fe676f13a5fec70aa721e";

function inspect(candidate) {
  const ids = candidate.map((record) => String(record).split("|", 1)[0]);
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  const canonical = candidate.join("\n");
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return {
    count: candidate.length,
    hash,
    duplicates: [...duplicates],
    locked:
      candidate.length === EXPECTED_TASK_COUNT &&
      hash === EXPECTED_SHA256 &&
      duplicates.size === 0,
  };
}

function assertRejected(name, candidate) {
  const result = inspect(candidate);
  if (result.locked) {
    console.error(`MASTER_ID_LOCK SELF-TEST FAILED: ${name} was incorrectly accepted.`);
    process.exit(1);
  }
  console.log(
    `MASTER_ID_LOCK SELF-TEST PASS: ${name} rejected · count=${result.count} · sha256=${result.hash}` +
      (result.duplicates.length ? ` · duplicate=${result.duplicates.join(",")}` : ""),
  );
}

const actual = inspect(records);
console.log(`MASTER_ID_LOCK count=${actual.count}`);
console.log(`MASTER_ID_LOCK sha256=${actual.hash}`);

if (!actual.locked) {
  console.error("MASTER_ID_LOCK FAILED: frozen task ID→meaning mapping changed.");
  console.error(`Expected count/hash: ${EXPECTED_TASK_COUNT} / ${EXPECTED_SHA256}`);
  console.error(`Actual count/hash:   ${actual.count} / ${actual.hash}`);
  if (actual.duplicates.length) {
    console.error(`Duplicate/reused IDs: ${actual.duplicates.join(", ")}`);
  }
  console.error("Do not insert/delete/reorder/reuse frozen master tasks. New discoveries must use append-only GAP IDs.");
  process.exit(1);
}

console.log("MASTER_ID_LOCK PASS: frozen master task IDs are unchanged.");

if (process.argv.includes("--self-test")) {
  if (records.length < 3) {
    console.error("MASTER_ID_LOCK SELF-TEST FAILED: insufficient frozen records.");
    process.exit(1);
  }

  // 32.02 negative proofs. These mutations must NEVER be accepted as the frozen plan.
  const deleted = records.slice(0, 1).concat(records.slice(2));
  assertRejected("silent delete", deleted);

  const renumbered = [...records];
  const [, phaseTitle, label] = renumbered[1].split("|");
  renumbered[1] = `99.99|${phaseTitle}|${label}`;
  assertRejected("silent renumber", renumbered);

  const reused = [...records];
  const reusedId = reused[0].split("|", 1)[0];
  const [, reusedPhaseTitle, reusedLabel] = reused[1].split("|");
  reused[1] = `${reusedId}|${reusedPhaseTitle}|${reusedLabel}`;
  assertRejected("ID reuse/duplicate", reused);

  console.log("MASTER_ID_LOCK SELF-TEST PASS: delete, renumber and ID reuse are all rejected.");
}
