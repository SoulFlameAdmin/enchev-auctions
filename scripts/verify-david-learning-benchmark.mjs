import assert from "node:assert/strict";
import { summarizeRuns, comparePerformance, benchmarkVerdict } from "../src/david/learning-benchmark.mjs";

const before=[
 {status:"completed",durationMs:2000,actionCount:5},
 {status:"failed",durationMs:2400,actionCount:6},
];
const after=[
 {status:"completed",durationMs:1200,actionCount:3},
 {status:"completed",durationMs:1400,actionCount:4},
];

const s=summarizeRuns(after);
assert.equal(s.successRate,1);

const c=comparePerformance(before,after);
assert.ok(c.delta.successRate>0);
assert.ok(c.delta.durationImprovementPct>0);
assert.ok(c.delta.actionReductionPct>0);

const v=benchmarkVerdict(c,{minSuccessDelta:0.2,minDurationImprovementPct:10});
assert.equal(v.pass,true);

const reg=benchmarkVerdict(comparePerformance(after,before));
assert.equal(reg.pass,false);

console.log("PASS david learning benchmark v1");
