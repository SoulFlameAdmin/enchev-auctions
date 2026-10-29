#!/usr/bin/env node
/**
 * SYSTEM 24.13: canonical evidence reconciliation.
 * A read-only proof gate. No DB writes, no status impersonation.
 */
import fs from "node:fs";
function must(condition,message){if(!condition)throw new Error("MASTER_24_13_RECONCILIATION FAIL: "+message);}
const source=fs.readFileSync("app/components/VerifiedPlanEvidenceSync.tsx","utf8");
const marker="const VERIFIED_WAVE_0";
const anchor=source.indexOf(marker);
const open=source.indexOf("{",anchor);
const close=source.indexOf("\n};",open);
must(anchor>=0&&open>=0&&close>open,"canonical evidence block missing");
const map=source.slice(open+1,close);
const entries=[...map.matchAll(/^\s*"([^"]+)":\s*("(?:[^"\\]|\\.)*"),?\s*$/gm)]
  .map(([,id,raw])=>[id,JSON.parse(raw)]);
must(entries.length===307,"expected 307 canonical verified entries, got "+entries.length);
must(new Set(entries.map(([id])=>id)).size===307,"duplicate verified task IDs");
const rows=new Map(entries);
const evidence=rows.get("24.13");
must(typeof evidence==="string" && evidence.length>=150,"24.13 evidence missing");
for(const required of [
  "docs/24_13_SCHEMA_COMPATIBILITY_TESTS.md",
  "config/enchev-schema-compatibility-baseline.json",
  "scripts/verify-schema-compatibility-tests.mjs",
  "dd76ee358531d060048df70cf41e205bce870f9b",
  "/actions/runs/35668127618 SUCCESS"
]){
  must(evidence.includes(required),"24.13 evidence lacks "+required);
}
const baseline=JSON.parse(fs.readFileSync("config/enchev-schema-compatibility-baseline.json","utf8"));
must(baseline.task==="24.13"&&baseline.version===1&&baseline.compatibilityLine==="v1",
  "24.13 contract identity drift");
const doc=fs.readFileSync("docs/24_13_SCHEMA_COMPATIBILITY_TESTS.md","utf8");
must(doc.includes("Status: **GREEN**")&&doc.includes("dd76ee358531d060048df70cf41e205bce870f9b"),
  "merged-main approval source missing");
console.log("MASTER_24_13_RECONCILIATION PASS verified_rows=307 target=24.13 source=merged-main; no remote writes");
