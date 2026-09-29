import assert from "node:assert/strict";
import { analyzeForSelfUpgrade } from "../src/david/weakness-detector.mjs";
import { buildCandidatePackage, candidateReadyForTesting } from "../src/david/upgrade-candidate-builder.mjs";
import { buildUpgradeTestMatrix, evaluateUpgradeTestMatrix } from "../src/david/upgrade-test-matrix.mjs";
import { buildPromotionPlan } from "../src/david/self-upgrade-controller.mjs";
import { postPromotionDecision } from "../src/david/post-promotion-observer.mjs";

const analysis=analyzeForSelfUpgrade({runs:[
 {status:"failed",error:"CDP timeout: Input.insertText",current_stage:"teacher"},
 {status:"failed",error:"CDP timeout: Input.insertText",current_stage:"teacher"}
]},{minSeverity:.5});
assert.equal(analysis.decision.shouldUpgrade,true);
const pkg=buildCandidatePackage(analysis.proposal,[{path:"src/david/alternate-cdp-strategy.mjs"}],{baseRevision:"rev-a",backupRef:"backup-a",branch:"candidate-1"});
assert.equal(candidateReadyForTesting(pkg).ready,true);
const matrix=buildUpgradeTestMatrix(pkg);
const results=Object.fromEntries(matrix.map(t=>[t.id,{status:"passed"}]));
const benchmark={before:{successRate:.5},after:{successRate:.8},delta:{successRate:.3,durationImprovementPct:15,actionReductionPct:10,failureReduction:1}};
const evaluation=evaluateUpgradeTestMatrix(matrix,results,benchmark,{minSuccessDelta:.1,minDurationImprovementPct:5});
assert.equal(evaluation.pass,true);
const candidate={id:"c1",user_id:"u1",status:"passed",backup_ref:"backup-a",base_revision:"rev-a",candidate_revision:"rev-b",artifact_sha256:"a".repeat(64)};
const testRun={status:"passed",artifact_sha256:"b".repeat(64)};
const promotion=buildPromotionPlan(candidate,testRun,benchmark,{thresholds:{minSuccessDelta:.1,minDurationImprovementPct:5}});
assert.equal(promotion.action,"promote_candidate");
const live=postPromotionDecision({...candidate,active_revision:"rev-b"},{successRate:.8},{successRate:.82,integrityOk:true});
assert.equal(live.action,"keep_promoted");
const bad=postPromotionDecision({...candidate,active_revision:"rev-b"},{successRate:.8},{successRate:.4,integrityOk:true});
assert.equal(bad.action,"auto_rollback");
console.log("PASS david stage 8 integration v1");
