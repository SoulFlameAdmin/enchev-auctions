const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function normalizeRunOutcome(run = {}) {
  const status = String(run.status || "").toLowerCase();
  const success = ["completed", "success", "passed", "green"].includes(status) || run.success === true;
  const failed = ["failed", "error", "red"].includes(status) || run.success === false;
  const durationMs = Number.isFinite(Number(run.durationMs)) ? Math.max(0, Number(run.durationMs)) : null;

  return {
    success: success && !failed,
    failed,
    status: status || "unknown",
    goal: String(run.goal || "").trim(),
    plan: Array.isArray(run.plan) ? run.plan : [],
    actions: Array.isArray(run.actions) ? run.actions : [],
    observations: Array.isArray(run.observations) ? run.observations : [],
    error: run.error ? String(run.error) : null,
    durationMs,
    evidence: Array.isArray(run.evidence) ? run.evidence : [],
  };
}

export function classifyLessonKind(outcome) {
  if (outcome.failed && outcome.error) return "error";
  if (outcome.success && outcome.actions.length > 0) return "procedure";
  if (outcome.observations.length > 0) return "fact";
  return "strategy";
}

export function confidenceFromEvidence(outcome, prior = { successCount: 0, failureCount: 0 }) {
  const evidenceWeight = Math.min(outcome.evidence.length, 5) * 0.08;
  const historyTotal = Math.max(0, Number(prior.successCount || 0)) + Math.max(0, Number(prior.failureCount || 0));
  const historyScore = historyTotal === 0 ? 0 : Number(prior.successCount || 0) / historyTotal;
  const base = outcome.success ? 0.58 : 0.32;
  return Number(clamp(base + evidenceWeight + historyScore * 0.2, 0.05, 0.99).toFixed(4));
}

export function deriveLesson(run, prior = {}) {
  const outcome = normalizeRunOutcome(run);
  const kind = classifyLessonKind(outcome);
  const confidence = confidenceFromEvidence(outcome, prior);

  let summary;
  if (kind === "error") {
    summary = `Failure pattern for goal "${outcome.goal || "unknown"}": ${outcome.error}`;
  } else if (kind === "procedure") {
    summary = `Successful procedure for goal "${outcome.goal || "unknown"}" using ${outcome.actions.length} action(s).`;
  } else if (kind === "fact") {
    summary = `Observed evidence relevant to goal "${outcome.goal || "unknown"}".`;
  } else {
    summary = `Strategy note for goal "${outcome.goal || "unknown"}".`;
  }

  return {
    kind,
    summary,
    confidence,
    reusable: outcome.success && outcome.evidence.length > 0,
    sourceStatus: outcome.status,
    sourceError: outcome.error,
    recipe: outcome.success ? outcome.actions : [],
    evidence: outcome.evidence,
    metrics: {
      durationMs: outcome.durationMs,
      actionCount: outcome.actions.length,
      observationCount: outcome.observations.length,
      evidenceCount: outcome.evidence.length,
    },
  };
}

export function shouldPromoteSkill(lesson, prior = {}) {
  const successes = Math.max(0, Number(prior.successCount || 0)) + (lesson.sourceStatus === "completed" || lesson.sourceStatus === "success" || lesson.sourceStatus === "passed" || lesson.sourceStatus === "green" ? 1 : 0);
  const failures = Math.max(0, Number(prior.failureCount || 0)) + (lesson.kind === "error" ? 1 : 0);

  return Boolean(
    lesson.reusable &&
    lesson.confidence >= 0.7 &&
    successes >= 2 &&
    failures <= Math.max(1, Math.floor(successes / 3))
  );
}

export function buildLearningCycle(run, prior = {}) {
  const outcome = normalizeRunOutcome(run);
  const lesson = deriveLesson(run, prior);
  return {
    version: 1,
    goal: outcome.goal,
    reviewStatus: "ready",
    lesson,
    promoteSkill: shouldPromoteSkill(lesson, prior),
    generatedAt: new Date().toISOString(),
  };
}
