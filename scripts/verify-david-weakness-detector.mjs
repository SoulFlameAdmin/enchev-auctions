import assert from "node:assert/strict";
import { detectWeaknesses, chooseUpgradeTarget, buildUpgradeProposal, analyzeForSelfUpgrade } from "../src/david/weakness-detector.mjs";

const runs=[
 {status:"failed",error:"CDP timeout: Input.insertText",current_stage:"teacher"},
 {status:"failed",error:"CDP timeout: Input.insertText",current_stage:"teacher"},
 {status:"completed"},
];
const skills=[
 {id:"skill-1",confidence:.7,success_count:1,failure_count:3},
 {id:"skill-2",confidence:.9,success_count:9,failure_count:1},
];
const benchmark={
 delta:{successRate:-.2,durationImprovementPct:-15,actionReductionPct:-5,failureReduction:-1}
};

const weaknesses=detectWeaknesses({runs,skills,benchmark});
assert.ok(weaknesses.some(w=>w.type==="repeated_failure"));
assert.ok(weaknesses.some(w=>w.type==="low_skill_reliability"));
assert.ok(weaknesses.some(w=>w.type==="success_regression"));
assert.ok(weaknesses.some(w=>w.type==="performance_regression"));

const decision=chooseUpgradeTarget(weaknesses,{minSeverity:.5});
assert.equal(decision.shouldUpgrade,true);

const proposal=buildUpgradeProposal(decision.target);
assert.ok(proposal.goal.includes("Improve DAVID weakness"));
assert.equal(proposal.acceptance.benchmarkRequired,true);

const analysis=analyzeForSelfUpgrade({runs,skills,benchmark},{minSeverity:.5});
assert.equal(analysis.decision.shouldUpgrade,true);
assert.ok(analysis.proposal);

const quiet=analyzeForSelfUpgrade({runs:[{status:"completed"}],skills:[],benchmark:{delta:{successRate:0,durationImprovementPct:5}}});
assert.equal(quiet.decision.shouldUpgrade,false);
assert.equal(quiet.proposal,null);

console.log("PASS david weakness detector v1");
