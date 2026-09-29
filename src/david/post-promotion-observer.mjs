import { buildRollbackPlan } from "./self-upgrade-controller.mjs";

export function evaluatePostPromotionHealth(baseline = {}, live = {}, options = {}) {
  const reasons=[];
  const minSuccessRate=Number.isFinite(Number(options.minSuccessRate))?Number(options.minSuccessRate):Number(baseline.successRate ?? 0);
  const maxFailureRate=Number.isFinite(Number(options.maxFailureRate))?Number(options.maxFailureRate):Math.max(0,1-minSuccessRate);
  const liveSuccess=Number(live.successRate ?? 0);
  const liveFailure=Number(live.failureRate ?? (1-liveSuccess));
  if (liveSuccess < minSuccessRate) reasons.push("success_rate_regression");
  if (liveFailure > maxFailureRate) reasons.push("failure_rate_regression");
  if (live.criticalFailure === true) reasons.push("critical_failure");
  if (live.integrityOk === false) reasons.push("integrity_failure");
  return { healthy:reasons.length===0, reasons, baseline, live };
}

export function postPromotionDecision(candidate = {}, baseline = {}, live = {}, options = {}) {
  const health=evaluatePostPromotionHealth(baseline,live,options);
  if (health.healthy) return {action:"keep_promoted",health};
  const rollback=buildRollbackPlan(candidate,health.reasons.join(","));
  return {action:rollback.action==="rollback" ? "auto_rollback" : "escalate",health,rollback};
}

export function buildObservationWindow(options = {}) {
  const minRuns=Math.max(1,Number(options.minRuns || 10));
  const maxRuns=Math.max(minRuns,Number(options.maxRuns || 50));
  return {minRuns,maxRuns,requireIntegrity:true,stopOnCriticalFailure:true};
}
