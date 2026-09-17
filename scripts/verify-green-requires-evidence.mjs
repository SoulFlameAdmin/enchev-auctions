import { readFileSync } from "node:fs";

const MASTER_PATH = "app/components/MasterSystemPlanV1.tsx";
const SYNC_PATH = "app/components/VerifiedPlanEvidenceSync.tsx";

const master = readFileSync(MASTER_PATH, "utf8");
const sync = readFileSync(SYNC_PATH, "utf8");

function parseLiteralBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) {
    throw new Error(`GREEN_EVIDENCE_GUARD: unable to locate ${label}`);
  }
  const literal = source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
  return Function(`"use strict"; return (${literal});`)();
}

function requireSourceInvariant(condition, message) {
  if (!condition) throw new Error(`GREEN_EVIDENCE_GUARD: ${message}`);
}

function greenTransition(status, evidence) {
  if (status === "green" && !String(evidence ?? "").trim()) return "yellow";
  return status;
}

const selfTest = process.argv.includes("--self-test");
if (selfTest) {
  const cases = [
    ["green", "", "yellow", "empty evidence is rejected"],
    ["green", "   ", "yellow", "whitespace evidence is rejected"],
    ["green", "commit abc123 · test PASS", "green", "real evidence permits GREEN"],
    ["yellow", "", "yellow", "YELLOW is unaffected"],
    ["red", "", "red", "RED is unaffected"],
  ];

  for (const [status, evidence, expected, label] of cases) {
    const actual = greenTransition(status, evidence);
    if (actual !== expected) {
      throw new Error(`GREEN_EVIDENCE_SELF_TEST FAILED: ${label}; expected ${expected}, got ${actual}`);
    }
    console.log(`GREEN_EVIDENCE_SELF_TEST PASS: ${label}`);
  }
  process.exit(0);
}

const raw = parseLiteralBetween(master, "const raw: RawPhase[] = ", "\n\nconst WAVE_LABELS", "frozen raw plan");
const verifiedEvidence = parseLiteralBetween(master, "const VERIFIED_EVIDENCE: Record<string,string> = ", "\n\nconst SK=", "VERIFIED_EVIDENCE");
const verifiedWave0 = parseLiteralBetween(sync, "const VERIFIED_WAVE_0: Record<string, string> = ", "\n\nexport default function", "VERIFIED_WAVE_0");

requireSourceInvariant(Array.isArray(raw), "raw plan is not an array");
requireSourceInvariant(verifiedEvidence && typeof verifiedEvidence === "object", "VERIFIED_EVIDENCE is not an object");
requireSourceInvariant(verifiedWave0 && typeof verifiedWave0 === "object", "VERIFIED_WAVE_0 is not an object");

const defaultGreenIds = [];
for (const phase of raw) {
  const [phaseId, , items] = phase;
  items.forEach((entry, index) => {
    const [, statusRaw] = String(entry).split("|");
    if (statusRaw === "green") defaultGreenIds.push(`${phaseId}.${String(index + 1).padStart(2, "0")}`);
  });
}

const missingDefaultEvidence = defaultGreenIds.filter((id) => !String(verifiedEvidence[id] ?? "").trim());
if (missingDefaultEvidence.length) {
  throw new Error(`GREEN_EVIDENCE_GUARD: default GREEN tasks missing VERIFIED_EVIDENCE: ${missingDefaultEvidence.join(", ")}`);
}

for (const [id, evidence] of Object.entries(verifiedWave0)) {
  const text = String(evidence ?? "").trim();
  if (!text) throw new Error(`GREEN_EVIDENCE_GUARD: ${id} has empty verified evidence`);
  if (/\b(?:TODO|TBD|PENDING_BASELINE|PLACEHOLDER)\b/i.test(text)) {
    throw new Error(`GREEN_EVIDENCE_GUARD: ${id} contains placeholder evidence`);
  }
}

const compactMaster = master.replace(/\s+/g, "");
requireSourceInvariant(compactMaster.includes('if(status==="green"){'), "GREEN transition branch is missing");
requireSourceInvariant(compactMaster.includes('constevidence=(notes[id]?.evidence||VERIFIED_EVIDENCE[id]||"").trim();'), "GREEN evidence source/trim check is missing");
requireSourceInvariant(compactMaster.includes('if(!evidence){'), "missing-evidence rejection branch is missing");
requireSourceInvariant(compactMaster.includes('persist({...statuses,[id]:"yellow"}'), "missing evidence no longer downgrades GREEN to YELLOW");
requireSourceInvariant(compactMaster.includes('GREENблокиран:добавиEvidence(URL/commit/testresult).'), "user-visible GREEN evidence blocker is missing");

const compactSync = sync.replace(/\s+/g, "");
requireSourceInvariant(compactSync.includes('statuses[id]="green";'), "verified sync no longer writes GREEN status");
requireSourceInvariant(compactSync.includes('notes[id]={evidence,updatedAt:stamp};'), "verified sync no longer writes evidence atomically with GREEN");

console.log(`GREEN_EVIDENCE_GUARD default_green_count=${defaultGreenIds.length}`);
console.log(`GREEN_EVIDENCE_GUARD verified_wave0_count=${Object.keys(verifiedWave0).length}`);
console.log("GREEN_EVIDENCE_GUARD PASS: every governed GREEN path requires non-empty evidence.");
