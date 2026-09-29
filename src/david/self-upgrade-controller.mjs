import { benchmarkVerdict } from "./learning-benchmark.mjs";

const TERMINAL = new Set(["failed","promoted","rolled_back","rejected"]);
const TESTABLE = new Set(["awaiting_test","testing","passed","failed"]);

export function validateUpgradeCandidate(candidate = {}) {
  const errors = [];
  if (!candidate.id) errors.push("candidate_id_required");
  if (!candidate.user_id) errors.push("user_id_required");
  if (!candidate.goal || String(candidate.goal).trim().length < 10) errors.push("goal_required");
  if (!candidate.thinker_response || String(candidate.thinker_response).trim().length < 1) errors.push("thinker_response_required");
  if (Number(candidate.actor_attempts || 0) > 3) errors.push("actor_attempt_budget_exceeded");
  return { valid: errors.length === 0, errors };
}

export function nextUpgradeState(candidate = {}, event, context = {}) {
  const status = String(candidate.status || "thinker_ready");
  if (TERMINAL.has(status)) return { status, changed: false, reason: "terminal_state" };

  switch (event) {
    case "actor_queued":
      if (!["thinker_ready","actor_blocked"].includes(status)) return { status, changed:false, reason:"invalid_transition" };
      return { status:"actor_queued", changed:true };
    case "actor_started":
      if (status !== "actor_queued") return { status, changed:false, reason:"invalid_transition" };
      return { status:"actor_processing", changed:true };
    case "actor_finished":
      if (status !== "actor_processing") return { status, changed:false, reason:"invalid_transition" };
      if (!context.package || Object.keys(context.package).length === 0) return { status:"failed", changed:true, reason:"missing_candidate_package" };
      return { status:"awaiting_test", changed:true };
    case "test_started":
      if (!["awaiting_test","passed"].includes(status)) return { status, changed:false, reason:"invalid_transition" };
      return { status:"testing", changed:true };
    case "test_passed":
      if (status !== "testing") return { status, changed:false, reason:"invalid_transition" };
      return { status:"passed", changed:true };
    case "test_failed":
      if (!TESTABLE.has(status)) return { status, changed:false, reason:"invalid_transition" };
      return { status:"failed", changed:true, reason:context.reason || "test_failed" };
    case "rollback":
      if (!["testing","passed","promoted"].includes(status)) return { status, changed:false, reason:"invalid_transition" };
      return { status:"rolled_back", changed:true };
    case "reject":
      return { status:"rejected", changed:true };
    default:
      return { status, changed:false, reason:"unknown_event" };
  }
}

export function promotionGate(candidate = {}, testRun = {}, benchmark = null, options = {}) {
  const reasons = [];
  if (candidate.status !== "passed") reasons.push("candidate_not_passed");
  if (testRun.status !== "passed") reasons.push("test_run_not_passed");
  if (!candidate.backup_ref) reasons.push("backup_ref_required");
  if (!candidate.base_revision) reasons.push("base_revision_required");
  if (!candidate.candidate_revision) reasons.push("candidate_revision_required");
  if (candidate.base_revision && candidate.candidate_revision && candidate.base_revision === candidate.candidate_revision) reasons.push("candidate_must_differ_from_base");
  if (!testRun.artifact_sha256 && !candidate.artifact_sha256) reasons.push("artifact_hash_required");

  if (benchmark) {
    const verdict = benchmarkVerdict(benchmark, options.thresholds || {});
    if (!verdict.pass) reasons.push("benchmark_not_passed");
  } else {
    reasons.push("benchmark_required");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function buildPromotionPlan(candidate = {}, testRun = {}, benchmark = null, options = {}) {
  const gate = promotionGate(candidate, testRun, benchmark, options);
  if (!gate.allowed) return { action:"hold", gate };

  return {
    action:"promote_candidate",
    gate,
    backupRef:candidate.backup_ref,
    fromRevision:candidate.base_revision,
    toRevision:candidate.candidate_revision,
    artifactSha256:testRun.artifact_sha256 || candidate.artifact_sha256,
  };
}

export function buildRollbackPlan(candidate = {}, reason = "regression_detected") {
  if (!candidate.backup_ref) {
    return { action:"escalate", reason:"backup_ref_missing" };
  }
  return {
    action:"rollback",
    reason,
    restoreRef:candidate.backup_ref,
    activeRevision:candidate.active_revision || candidate.candidate_revision || null,
  };
}
