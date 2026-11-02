import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const readText=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const p=read("app/data/urgent-119-days.json");
const l=read("app/data/urgent-legal-foundation-v1.json");
const d=read("app/data/urgent-daily-questions-v1.json");
assert.equal(p.tasks.length,119);
assert.equal(p.plannedTeamHours,799);
assert.equal(l.requirements.length,163);
assert.equal(d.counts.days,119);
assert.equal(d.days.length,119);
assert.equal(d.questions.length,1190);
assert.equal(new Set(d.questions.map(x=>x.id)).size,d.questions.length);
const taskIds=new Set(p.tasks.map(x=>x.id));
const legalIds=new Set(l.requirements.map(x=>x.id));
const questionIds=new Set(d.questions.map(x=>x.id));
for(const [i,day] of d.days.entries()){
 const task=p.tasks[i];
 assert.equal(day.dayId,task.id,"Day sequence must preserve plan");
 assert.equal(day.date,task.date,"Dates must not be changed");
 assert.equal(day.task,task.title,"Question focus must match live plan");
 assert.equal(day.questionIds.length,10,"Exactly ten daily questions");
 assert.ok(day.relatedLegalIds.length>=2,"Every day has related legal considerations");
 for(const id of day.relatedLegalIds)assert.ok(legalIds.has(id),"Legal link not valid: "+id);
 for(const id of day.questionIds){
  assert.ok(questionIds.has(id),"Question ID absent: "+id);
  const q=d.questions.find(x=>x.id===id);
  assert.equal(q.dayId,day.dayId);
  assert.equal(q.date,day.date);
  assert.ok(taskIds.has(q.linkedTask));
  assert.ok(q.question.length>35);
  assert.ok(q.acceptance.length>25);
 }
}
for(const q of d.questions){
 assert.ok(["P0","P1"].includes(q.priority));
 assert.ok(q.owner&&q.category);
}
const ui=readText("app/components/DailyQuestions119.tsx");
const urgent=readText("app/components/UrgentPlan119.tsx");
const legalUi=readText("app/components/LegalFoundationCenter.tsx");
assert.ok(urgent.includes("<DailyQuestions119 today={today}"));
assert.ok(urgent.indexOf("<DailyQuestions119")<urgent.indexOf("<LegalFoundationCenter />"));
assert.ok(ui.includes("enchev-daily-answers-v1"));
assert.ok(ui.includes("localStorage"));
assert.ok(ui.includes("isAccepted"));
assert.ok(ui.includes("a.evidence.trim()"));
assert.ok(ui.includes("a.answer.trim()"));
assert.ok(ui.includes("previousCarry"));
assert.ok(ui.includes("JSON архив"));
assert.ok(ui.includes("enchev-legal-focus")&&legalUi.includes("enchev-legal-focus"));
assert.ok(ui.includes("ДНЕС · "));
console.log("URGENT_DAILY_QUESTIONS PASS days=119 questions=1190 perDay=10 legalLinks=valid 119-day baseline=799h");
