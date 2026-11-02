import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const legal=read("app/data/urgent-legal-foundation-v1.json");
const days=read("app/data/urgent-119-days.json");
const html=readFileSync(new URL("../app/components/UrgentPlan119.tsx",import.meta.url),"utf8");
const center=readFileSync(new URL("../app/components/LegalFoundationCenter.tsx",import.meta.url),"utf8");
assert.equal(days.tasks.length,119,"119-day schedule must be preserved");
assert.equal(days.plannedTeamHours,799,"existing team-hour baseline must not change");
assert.equal(legal.requirements.length,163);
assert.equal(legal.launchGates.length,11);
assert.equal(new Set(legal.requirements.map(r=>r.id)).size,163);
assert.equal(new Set(legal.requirements.map(r=>r.number)).size,163);
assert.equal(new Set(legal.requirements.map(r=>r.category)).size,12);
const daySet=new Set(days.tasks.map(t=>t.id));
const catalogIds=new Set(legal.requirements.map(r=>r.id));
for(const [i,r] of legal.requirements.entries()){
 assert.equal(r.id,`LEG-${String(i+1).padStart(3,"0")}`);
 assert.equal(r.number,i+1);
 assert.ok(daySet.has(r.linkedDay),`Missing linked day: ${r.id}`);
 assert.ok(/^20\d\d-\d\d-\d\d$/.test(r.dueDate));
 assert.ok(r.title&&r.reason&&r.implementation&&r.acceptance&&r.owner&&r.question);
 assert.equal(r.defaultStatus,"unresolved","No legal requirement may be pre-approved");
}
for(const gate of legal.launchGates){
 assert.ok(gate.items.length>0);
 assert.ok(gate.items.every(id=>catalogIds.has(id)));
}
assert.ok(html.indexOf("<LegalFoundationCenter />")>0);
assert.ok(html.indexOf("<LegalFoundationCenter />")<html.indexOf("01 / СЕДМИЦИ"),"legal foundation must precede weekly tracker");
assert.ok(center.includes('localStorage'));
assert.ok(center.includes('status==="approved"'));
assert.ok(center.includes('v.evidence.trim()'));
assert.ok(center.includes('v.reviewer.trim()'));
assert.ok(center.includes('v.testEvidence.trim()'));
assert.ok(center.includes('Нищо с реални пари'));
console.log("URGENT_LEGAL_FOUNDATION PASS requirements=163 categories=12 launch-gates=11 days=119 baseline=799h");
