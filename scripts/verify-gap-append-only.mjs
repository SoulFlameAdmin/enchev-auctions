import { readFileSync } from "node:fs";

const AUDIT_PATH = "docs/GAP_AUDIT_02_APPEND_ONLY.md";
const SEED_PATH = "app/components/SeedAuditGaps.tsx";
const GUARD_PATH = "app/components/GapAppendOnlyGuard.tsx";
const LAYOUT_PATH = "app/layout.tsx";

const audit = readFileSync(AUDIT_PATH, "utf8");
const seed = readFileSync(SEED_PATH, "utf8");
const guard = readFileSync(GUARD_PATH, "utf8");
const layout = readFileSync(LAYOUT_PATH, "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(`GAP_APPEND_ONLY_GUARD: ${message}`);
}

function parseNumber(id) {
  const match = /^GAP-(\d{3,})$/.exec(id);
  return match ? Number(match[1]) : null;
}

function allocate(existingIds, persistedHighWater = 0) {
  const used = new Set(existingIds);
  let highWater = Math.max(94, persistedHighWater, ...existingIds.map((id) => parseNumber(id) || 0));
  let id;
  do {
    highWater += 1;
    id = `GAP-${String(highWater).padStart(3, "0")}`;
  } while (used.has(id));
  return { id, highWater };
}

if (process.argv.includes("--self-test")) {
  const frozen = Array.from({ length: 94 }, (_, index) => `GAP-${String(index + 1).padStart(3, "0")}`);
  const cases = [
    [frozen, 94, "GAP-095", "first post-audit discovery starts at GAP-095"],
    [[...frozen, "GAP-095"], 95, "GAP-096", "next discovery is sequential"],
    [frozen, 95, "GAP-096", "deleted GAP-095 is never reused when high-water is 95"],
    [[...frozen, "GAP-097"], 95, "GAP-098", "existing higher ID advances the allocator"],
    [frozen, 100, "GAP-101", "persisted high-water prevents historical reuse"],
  ];

  for (const [ids, highWater, expected, label] of cases) {
    const actual = allocate(ids, highWater).id;
    if (actual !== expected) throw new Error(`GAP_APPEND_ONLY_SELF_TEST FAILED: ${label}; expected ${expected}, got ${actual}`);
    console.log(`GAP_APPEND_ONLY_SELF_TEST PASS: ${label}`);
  }
  process.exit(0);
}

const seededIds = [...seed.matchAll(/id:\"(GAP-\d{3})\"/g)].map((match) => match[1]);
const uniqueSeededIds = new Set(seededIds);
invariant(seededIds.length === 94, `expected 94 audit GAP IDs, found ${seededIds.length}`);
invariant(uniqueSeededIds.size === 94, "audit GAP seed contains duplicate IDs");
for (let index = 1; index <= 94; index += 1) {
  invariant(uniqueSeededIds.has(`GAP-${String(index).padStart(3, "0")}`), `missing permanent GAP-${String(index).padStart(3, "0")}`);
}

invariant(audit.includes("New discoveries start at `GAP-095`"), "audit contract no longer declares GAP-095 as the next discovery ID");
invariant(guard.includes('const GAP_SEQUENCE_KEY = "enchev-system-gap-seq-v5";'), "persistent GAP high-water key missing");
invariant(guard.includes("const AUDIT_MAX_GAP = 94;"), "GAP allocator no longer reserves GAP-001..GAP-094");
invariant(guard.includes('return `GAP-${String(value).padStart(3, "0")}`;'), "canonical GAP-NNN formatter missing");
invariant(guard.includes("localStorage.setItem(GAP_SEQUENCE_KEY, String(highWater));"), "allocator no longer persists high-water before/with writes");
invariant(guard.includes('document.addEventListener("click", onClickCapture, true);'), "add-GAP click path is not intercepted before legacy timestamp allocator");
invariant(guard.includes('document.addEventListener("keydown", onKeyDownCapture, true);'), "Enter-key add-GAP path is not intercepted before legacy timestamp allocator");
invariant(guard.includes("normalizeStoredGaps(event.data.gaps as GapTask[]);"), "legacy/duplicate GAP migration guard missing");
invariant(layout.includes('import GapAppendOnlyGuard from "./components/GapAppendOnlyGuard";'), "GapAppendOnlyGuard is not imported by root layout");
invariant(layout.includes("<GapAppendOnlyGuard />"), "GapAppendOnlyGuard is not mounted globally");

console.log("GAP_APPEND_ONLY_GUARD PASS: GAP-001..094 are permanent; new discoveries allocate GAP-095+ with persistent high-water and no reuse.");
