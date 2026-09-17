import { readFileSync } from "node:fs";

const MASTER_PATH = "app/components/MasterSystemPlanV1.tsx";
const TEST_GUARD_PATH = "app/components/TestPassGreenGuard.tsx";
const GREEN_GUARD_PATH = "scripts/verify-green-requires-evidence.mjs";

const master = readFileSync(MASTER_PATH, "utf8");
const testGuard = readFileSync(TEST_GUARD_PATH, "utf8");
const greenGuard = readFileSync(GREEN_GUARD_PATH, "utf8");

function requireInvariant(condition, message) {
  if (!condition) throw new Error(`YELLOW_SEMANTICS_GUARD: ${message}`);
}

function classify({ implemented = false, verified = false, error = false, pending = false, partial = false } = {}) {
  if (!implemented) return "red";
  if (error || pending || partial || !verified) return "yellow";
  return "green";
}

if (process.argv.includes("--self-test")) {
  const cases = [
    [{ implemented: true, partial: true }, "yellow", "partial implementation stays YELLOW"],
    [{ implemented: true, error: true }, "yellow", "error stays YELLOW"],
    [{ implemented: true, pending: true }, "yellow", "pending verification stays YELLOW"],
    [{ implemented: true, verified: false }, "yellow", "implemented but unverified stays YELLOW"],
    [{ implemented: true, verified: true }, "green", "implemented and verified becomes GREEN"],
    [{ implemented: false }, "red", "not implemented remains RED"],
  ];

  for (const [input, expected, label] of cases) {
    const actual = classify(input);
    if (actual !== expected) throw new Error(`YELLOW_SEMANTICS_SELF_TEST FAILED: ${label}; expected ${expected}, got ${actual}`);
    console.log(`YELLOW_SEMANTICS_SELF_TEST PASS: ${label}`);
  }
  process.exit(0);
}

const compactMaster = master.replace(/\s+/g, "");
const compactTestGuard = testGuard.replace(/\s+/g, "");
const compactGreenGuard = greenGuard.replace(/\s+/g, "");

requireInvariant(master.includes('type Status = "green" | "yellow" | "red";'), "three-state status contract changed");
requireInvariant(compactMaster.includes('persist({...statuses,[id]:"yellow"}'), "missing-evidence runtime path no longer downgrades to YELLOW");
requireInvariant(compactTestGuard.includes('nextStatuses[id]="yellow";'), "failed/pending test evidence no longer downgrades GREEN to YELLOW");
requireInvariant(compactGreenGuard.includes('if(status==="green"&&!String(evidence??"").trim())return"yellow";'), "GREEN evidence policy no longer maps unverified GREEN to YELLOW");
requireInvariant(master.includes("Има тест, грешка, blocker или липсва evidence"), "YELLOW task explanation no longer communicates error/pending verification semantics");
requireInvariant(master.includes("YELLOW = частично/грешка/липсваща проверка"), "footer no longer defines YELLOW as partial/error/pending verification");
requireInvariant(master.includes("ТЕСТ / ГРЕШКА"), "YELLOW KPI label changed without governance review");

console.log("YELLOW_SEMANTICS_GUARD PASS: YELLOW remains partial/error/pending verification; RED remains not implemented; GREEN remains verified.");
