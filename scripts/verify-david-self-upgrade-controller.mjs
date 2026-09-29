import assert from "node:assert/strict";
import { validateUpgradeCandidate, nextUpgradeState, promotionGate, buildPromotionPlan, buildRollbackPlan } from "../src/david/self-upgrade-controller.mjs";

const c={
 id:"c1",user_id:"u1",goal:"Improve DAVID retry planning safely",
 thinker_response:"Use benchmarked alternative planning",
 status:"passed",actor_attempts:1,backup_ref:"backup-1",
 base_revision:"rev-a",candidate_revision:"rev-b",artifact_sha256:"a".repeat(64)
};
assert.equal(validateUpgradeCandidate(c).valid,true);
assert.equal(nextUpgradeState({...c,status:"thinker_ready"},"actor_queued").status,"actor_queued");
assert.equal(nextUpgradeState({...c,status:"actor_processing"},"actor_finished",{package:{files:["x"]}}).status,"awaiting_test");

const testRun={status:"passed",artifact_sha256:"b".repeat(64)};
const benchmark={
 before:{successRate:.5},after:{successRate:1},
 delta:{successRate:.5,durationImprovementPct:20,actionReductionPct:10,failureReduction:1}
};
const gate=promotionGate(c,testRun,benchmark,{thresholds:{minSuccessDelta:.1,minDurationImprovementPct:5}});
assert.equal(gate.allowed,true);
assert.equal(buildPromotionPlan(c,testRun,benchmark).action,"promote_candidate");

const blocked=promotionGate({...c,backup_ref:null},testRun,benchmark);
assert.equal(blocked.allowed,false);
assert.ok(blocked.reasons.includes("backup_ref_required"));

assert.equal(buildRollbackPlan(c).action,"rollback");
assert.equal(buildRollbackPlan({...c,backup_ref:null}).action,"escalate");

console.log("PASS david self-upgrade controller v1");
