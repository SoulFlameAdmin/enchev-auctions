import assert from "node:assert/strict";
import {
  assembleAutonomyLearningInput,
  buildAutonomyLessonRecord,
  buildSkillCandidate,
} from "../src/david/autonomy-learning-persistence.mjs";

const run = {
  id: "run-1",
  task_id: "task-1",
  owner_id: "owner-1",
  worker_id: "DAVID-PC-01",
  status: "completed",
  plan: { summary: "Check app health", steps: [{ id: "p1" }] },
  outcome: { completed_steps: 2 },
  started_at: "2026-09-29T08:00:00Z",
  completed_at: "2026-09-29T08:00:02Z",
};

const steps = [
  { sequence: 2, status: "completed", step_kind: "verify", tool_name: "compare", output: { ok: true } },
  { sequence: 1, status: "completed", step_kind: "act", tool_name: "health_check", output: { status: 200 } },
];

const observations = [
  { kind: "http", summary: "health returned 200", data: { status: 200 } },
  { kind: "marker", summary: "expected marker found", sha256: "abc", data: { found: true } },
];

const input = assembleAutonomyLearningInput(run, steps, observations);
assert.equal(input.goal, "Check app health");
assert.equal(input.actions[0].sequence, 1);
assert.equal(input.actions.length, 2);
assert.equal(input.evidence.length, 2);
assert.equal(input.durationMs, 2000);

const record = buildAutonomyLessonRecord(run, steps, observations, { successCount: 1, failureCount: 0 });
assert.equal(record.lesson.kind, "procedure");
assert.equal(record.promoteSkill, true);

const skill = buildSkillCandidate(record, "health-check-procedure");
assert.equal(skill.name, "health-check-procedure");
assert.equal(skill.source, "autonomy_learning");
assert.equal(skill.requires_confirmation, true);
assert.equal(skill.enabled, true);
assert.equal(skill.definition.source_run_id, "run-1");

const failed = buildAutonomyLessonRecord({ ...run, id: "run-2", status: "failed", error: "timeout" }, [], [], { successCount: 9, failureCount: 0 });
assert.equal(failed.promoteSkill, false);
assert.equal(buildSkillCandidate(failed), null);

console.log("PASS david autonomy learning persistence v1");
