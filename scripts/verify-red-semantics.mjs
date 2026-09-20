import { readFileSync } from "node:fs";

const MASTER_PATH = "app/components/MasterSystemPlanV1.tsx";
const master = readFileSync(MASTER_PATH, "utf8");

function requireInvariant(condition, message) {
  if (!condition) throw new Error(`RED_SEMANTICS_GUARD: ${message}`);
}

function classify({ implemented = false, verified = false, error = false, pending = false, partial = false } = {}) {
  if (!implemented) return "red";
  if (error || pending || partial || !verified) return "yellow";
  return "green";
}

if (process.argv.includes("--self-test")) {
  const cases = [
    [{ implemented: false }, "red", "not implemented is RED"],
    [{ implemented: false, verified: true }, "red", "verification metadata cannot make missing implementation non-RED"],
    [{ implemented: true, verified: false }, "yellow", "implemented but unverified is YELLOW, not RED"],
    [{ implemented: true, partial: true }, "yellow", "partial implementation is YELLOW, not RED"],
    [{ implemented: true, error: true }, "yellow", "implementation error is YELLOW, not RED"],
    [{ implemented: true, pending: true }, "yellow", "pending verification is YELLOW, not RED"],
    [{ implemented: true, verified: true }, "green", "implemented and verified is GREEN, not RED"],
  ];

  for (const [input, expected, label] of cases) {
    const actual = classify(input);
    if (actual !== expected) throw new Error(`RED_SEMANTICS_SELF_TEST FAILED: ${label}; expected ${expected}, got ${actual}`);
    console.log(`RED_SEMANTICS_SELF_TEST PASS: ${label}`);
  }
  process.exit(0);
}

const compactMaster = master.replace(/\s+/g, "");

requireInvariant(master.includes('type Status = "green" | "yellow" | "red";'), "three-state status contract changed");
requireInvariant(compactMaster.includes('constdefaultStatus:Status=statusRaw==="green"||statusRaw==="yellow"?statusRaw:"red";'), "unspecified frozen tasks no longer default to RED");
requireInvariant(compactMaster.includes('functiondefaultsFor(source:Phase[])'), "runtime defaults helper is missing");
requireInvariant(compactMaster.includes('out[t.id]=t.defaultStatus'), "runtime defaults helper no longer preserves task defaultStatus");
requireInvariant(compactMaster.includes('useState<Record<string,Status>>(()=>defaultsFor(frozenPhases))'), "frozen runtime defaults no longer initialize from task defaultStatus");
requireInvariant(compactMaster.includes('if(!(task.idinnext))next[task.id]=task.defaultStatus'), "lazy expansion tasks no longer initialize from task defaultStatus");
requireInvariant(compactMaster.includes('defaultStatus:"red",kind:"core"'), "new GAP tasks no longer start RED");
requireInvariant(compactMaster.includes('persist({...statuses,[id]:"red"},notes,[...gaps,g])'), "new GAP runtime status no longer persists RED");
requireInvariant(master.includes('"Още не е построено"'), "RED task explanation no longer means not implemented");
requireInvariant(master.includes('const totalMissingLabel=expansionState==="ready"?String(totals.red):expansionState==="error"?"ERROR":"…";'), "grand missing KPI no longer derives from total RED count after full tracker load");
requireInvariant(master.includes('<span>ОБЩО ЛИПСВАЩИ</span><b>{totalMissingLabel}</b>'), "RED KPI no longer exposes the grand missing/not-implemented total");
requireInvariant(master.includes('RED = липсва.'), "footer no longer defines RED as missing");
requireInvariant(compactMaster.includes('constprogress=all.length?Math.round(totals.green/all.length*100):0;'), "progress calculation changed so non-GREEN could count as complete");

console.log("RED_SEMANTICS_GUARD PASS: RED remains not implemented; YELLOW remains partial/error/pending verification; GREEN remains verified completion.");
