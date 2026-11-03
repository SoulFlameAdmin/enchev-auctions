import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
const file=JSON.parse(read("app/data/urgent-copart-parity-v1.json"));
const plan=JSON.parse(read("app/data/urgent-119-days.json"));
const legal=JSON.parse(read("app/data/urgent-legal-foundation-v1.json"));
const screen=read("app/components/CopartParityCenter.tsx");
const urgent=read("app/components/UrgentPlan119.tsx");
const css=read("app/components/urgent-copart-parity.css");
const docs=read("docs/urgent-copart-benchmark-gaps-2026-11-03.md");

assert.equal(plan.taskCount,119,"immutable 119-day baseline task count");
assert.equal(plan.tasks.length,119,"immutable 119-day baseline tasks");
assert.equal(plan.startsOn,"2026-11-03");
assert.equal(plan.launchDate,"2027-03-01");
assert.equal(plan.plannedTeamHours,799,"original 799 planned team hours preserved");
assert.equal(legal.requirements.length,163,"original legal catalog remains 163");
assert.equal(file.baseline.days,119);
assert.equal(file.baseline.immutable,true);
assert.equal(file.baseline.plannedTeamHours,799);

const days=new Set(plan.tasks.map(x=>x.id));
const legals=new Set(legal.requirements.map(x=>x.id));
assert.equal(file.features.length,76,"76 function controls");
assert.equal(file.feeComponents.length,20,"20 fee components");
assert.equal(file.documentWorkflows.length,17,"17 document flows");
assert.equal(file.decisionGates.length,8,"8 signed business gates");
assert.equal(file.features.filter(x=>x.priority==="P0").length,69);
assert.equal(file.features.filter(x=>x.priority==="P1").length,7);
assert.equal(new Set(file.features.map(x=>x.id)).size,file.features.length);
assert.equal(new Set(file.feeComponents.map(x=>x.code)).size,file.feeComponents.length);
assert.equal(new Set(file.documentWorkflows.map(x=>x.code)).size,file.documentWorkflows.length);
assert.equal(file.features.filter(x=>x.baselineCoverage==="explicit").length,27);
assert.equal(file.features.filter(x=>x.baselineCoverage==="partial").length,23);
assert.equal(file.features.filter(x=>x.baselineCoverage==="gap").length,26);

for(const f of file.features){
  assert.match(f.id,/^CP-\d{3}$/);
  assert.ok(days.has(f.linkedDay),`invalid mapped day ${f.id}`);
  assert.ok(f.linkedDay!=="D001","Accepted D001 audit cannot acquire new release gates");
  assert.ok(["explicit","partial","gap"].includes(f.baselineCoverage));
  assert.equal(f.implementationStatus,"planned","never auto-mark planned competitor feature done");
  assert.ok(f.title?.length>12&&f.acceptance?.length>20,"Every control must define measurable acceptance");
  assert.ok(file.sourceLinks[f.sourceKey]?.startsWith("https://"),"Source-backed comparison required");
  for(const l of f.legalRefs)assert.ok(legals.has(l),`Unknown linked legal item ${f.id} ${l}`);
  const day=plan.tasks.find(x=>x.id===f.linkedDay);
  assert.ok(day.date<=plan.launchDate,"No post-launch D link");
  assert.equal(f.delivery,f.priority==="P0"?"conditional-by-2027-03-01":"phase-2-or-after-pilot");
}
for(const f of file.feeComponents){
  assert.match(f.id,/^FEE-\d{2}$/);
  assert.ok(days.has(f.linkedDay));
  assert.equal(f.enabled,false,"Do NOT activate unapproved fees");
  assert.equal(f.amount,null,"Do NOT import Copart rates as E&A charges");
  assert.equal(f.feeRuleVersion,null);
  assert.equal(f.taxTreatment,"requires-accountant-review");
}
for(const d of file.documentWorkflows){
  assert.match(d.id,/^DOC-\d{2}$/);
  assert.ok(days.has(d.linkedDay));
  assert.equal(d.templateStatus,"not-legal-approved");
  assert.equal(d.implementationStatus,"planned");
  assert.ok(d.states?.length>=2);
}
for(const gate of file.decisionGates){
  assert.ok(days.has(gate.byDay));
  assert.match(gate.state,/^pending-/);
}
const price=file.competitorPricingReference;
assert.equal(price.referenceOnly,true,"Copart rate is competitor benchmark only");
assert.equal(price.effectiveDate,"2026-01-06");
assert.equal(price.buyerFeeEUR.length,19);
assert.equal(price.buyerFeeHighTier.fromCents,1550000);
let previous=0;
for(const tier of price.buyerFeeEUR){
  assert.equal(tier.fromCents,previous+1,"fee tier boundaries must be continuous, no gaps");
  assert.ok(tier.toCents>=tier.fromCents);
  previous=tier.toCents;
}
assert.equal(previous,1549999);
const buyerAtFiveK=price.buyerFeeEUR.find(t=>500000>=t.fromCents&&500000<=t.toCents);
assert.equal(buyerAtFiveK.amountCents,45494,"5k fee reference correct");
const fee100=price.onlineBidEUR[0];
assert.equal(fee100.amountCents,1057);
assert.equal(price.otherEUR.lotRetrieval,45);
assert.ok(price.ambiguities.some(x=>x.includes("31.70")),"disclose conflicting Copart mirrors");
assert.match(file.sourcePolicy,/not Copart code/);
assert.ok(docs.includes("D057–D070")&&docs.includes("NO-GO"));
assert.match(screen,/localStorage/);
assert.match(screen,/\baccepted\b/);
assert.match(screen,/entry\.test!=="pass"/);
assert.match(screen,/entry\.evidence\.trim\(\)/);
assert.match(screen,/implementationStatus|Статус на реализация/);
assert.match(urgent,/import CopartParityCenter from ".\/CopartParityCenter"/);
assert.match(urgent,/<CopartParityCenter onOpenTask=/);
assert.ok(css.includes("@media(max-width:690px)"),"mobile dashboard presentation");
console.log(`URGENT_COPART_PARITY PASS features=${file.features.length} fees=${file.feeComponents.length} documents=${file.documentWorkflows.length} gates=${file.decisionGates.length} gap=${file.features.filter(x=>x.baselineCoverage==="gap").length}`);
