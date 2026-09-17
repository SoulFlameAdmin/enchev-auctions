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
const seen = new Set();
for (const phase of raw) {
  if (!Array.isArray(phase) || phase.length !== 3 || !Array.isArray(phase[2])) {
    console.error("MASTER_ID_LOCK: malformed phase entry");
    process.exit(1);
  }
  const [phaseId, phaseTitle, items] = phase;
  items.forEach((entry, index) => {
    const [label] = String(entry).split("|");
    const taskId = `${phaseId}.${String(index + 1).padStart(2, "0")}`;
    if (seen.has(taskId)) {
      console.error(`MASTER_ID_LOCK: duplicate task ID ${taskId}`);
      process.exit(1);
    }
    seen.add(taskId);
    records.push(`${taskId}|${phaseTitle}|${label}`);
  });
}

const canonical = records.join("\n");
const actualHash = createHash("sha256").update(canonical, "utf8").digest("hex");
const actualCount = records.length;

// MASTER SYSTEM PLAN v1.0 FROZEN identity lock.
// Changing this baseline is a governance event, never a routine edit.
const EXPECTED_TASK_COUNT = 0;
const EXPECTED_SHA256 = "PENDING_BASELINE";

console.log(`MASTER_ID_LOCK count=${actualCount}`);
console.log(`MASTER_ID_LOCK sha256=${actualHash}`);

if (actualCount !== EXPECTED_TASK_COUNT || actualHash !== EXPECTED_SHA256) {
  console.error("MASTER_ID_LOCK FAILED: frozen task ID→meaning mapping changed.");
  console.error(`Expected count/hash: ${EXPECTED_TASK_COUNT} / ${EXPECTED_SHA256}`);
  console.error(`Actual count/hash:   ${actualCount} / ${actualHash}`);
  console.error("Do not insert/delete/reorder/reuse frozen master tasks. New discoveries must use append-only GAP IDs.");
  process.exit(1);
}

console.log("MASTER_ID_LOCK PASS: frozen master task IDs are unchanged.");
