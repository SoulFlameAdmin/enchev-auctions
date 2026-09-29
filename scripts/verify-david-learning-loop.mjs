import assert from "node:assert/strict";
import {
  normalizeRunOutcome,
  deriveLesson,
  shouldPromoteSkill,
  buildLearningCycle,
} from "../src/david/learning-loop.mjs";

const successRun = {
  status: "completed",
  goal: "Verify deployment health",
  actions: [{ tool: "health_check" }, { tool: "compare_result" }],
  observations: [{ ok: true }],
  evidence: ["health=200", "expected marker found"],
  durationMs: 1200,
};

const outcome = normalizeRunOutcome(successRun);
assert.equal(outcome.success, true);
assert.equal(outcome.failed, false);

const lesson = deriveLesson(successRun, { successCount: 1, failureCount: 0 });
assert.equal(lesson.kind, "procedure");
assert.equal(lesson.reusable, true);
assert.ok(lesson.confidence >= 0.7);
assert.equal(lesson.metrics.evidenceCount, 2);

assert.equal(
  shouldPromoteSkill(lesson, { successCount: 1, failureCount: 0 }),
  true,
  "second evidenced success should be eligible for skill promotion",
);

const failedLesson = deriveLesson({
  status: "failed",
  goal: "Send prompt",
  error: "bounded recovery exhausted",
  evidence: [],
});
assert.equal(failedLesson.kind, "error");
assert.equal(failedLesson.reusable, false);
assert.equal(shouldPromoteSkill(failedLesson, { successCount: 5, failureCount: 0 }), false);

const cycle = buildLearningCycle(successRun, { successCount: 1, failureCount: 0 });
assert.equal(cycle.version, 1);
assert.equal(cycle.reviewStatus, "ready");
assert.equal(cycle.promoteSkill, true);

console.log("PASS david learning loop v1");
