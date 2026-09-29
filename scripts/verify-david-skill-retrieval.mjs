import assert from "node:assert/strict";
import {
  skillEligibility,
  scoreSkillForGoal,
  rankSkillsForGoal,
  selectStrategyForGoal,
} from "../src/david/skill-retrieval.mjs";

const skills = [
  {
    id: "s1",
    name: "health check deployment verification",
    description: "Verify deployment health and expected application markers",
    definition: { kind: "procedure", recipe: [{ tool: "health_check" }, { tool: "compare_result" }] },
    confidence: 0.91,
    success_count: 8,
    failure_count: 1,
    risk_level: "low",
    requires_confirmation: false,
    enabled: true,
  },
  {
    id: "s2",
    name: "dangerous production mutation",
    description: "Change production settings",
    definition: { kind: "procedure", recipe: [{ tool: "prod_mutate" }] },
    confidence: 0.99,
    success_count: 20,
    failure_count: 0,
    risk_level: "high",
    requires_confirmation: true,
    enabled: true,
  },
  {
    id: "s3",
    name: "generic browser navigation",
    description: "Open a browser tab",
    definition: { kind: "procedure", recipe: [{ tool: "browser.open" }] },
    confidence: 0.61,
    success_count: 2,
    failure_count: 1,
    risk_level: "low",
    requires_confirmation: false,
    enabled: true,
  },
];

assert.deepEqual(skillEligibility(skills[0]), { eligible: true, reason: "ok" });
assert.equal(skillEligibility(skills[1]).eligible, false);
assert.ok(scoreSkillForGoal("verify deployment health", skills[0]) > scoreSkillForGoal("verify deployment health", skills[2]));

const ranked = rankSkillsForGoal("verify deployment health", skills);
assert.equal(ranked[0].skill.id, "s1");

const selection = selectStrategyForGoal("verify deployment health", skills);
assert.equal(selection.strategy, "reuse_skill");
assert.equal(selection.selectedSkill.id, "s1");

const fresh = selectStrategyForGoal("compose orchestral soundtrack", skills);
assert.equal(fresh.strategy, "plan_fresh");
assert.equal(fresh.selectedSkill, null);

const confirmedGate = skillEligibility(
  { ...skills[0], requires_confirmation: true },
  { requireConfirmed: true },
);
assert.equal(confirmedGate.eligible, false);

console.log("PASS david skill retrieval v1");
