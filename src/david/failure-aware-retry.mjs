const normalizeError = (value) => String(value || "")
  .toLowerCase()
  .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/g, "<id>")
  .replace(/\b\d+ms\b/g, "<duration>")
  .replace(/\s+/g, " ")
  .trim();

export function failureSignature(run = {}) {
  const status = String(run.status || "").toLowerCase();
  if (!["failed","error","red"].includes(status) && !run.error) return null;
  const tool = run.tool || run.tool_name || run.lastTool || "";
  const stage = run.current_stage || run.stage || "";
  return [normalizeError(run.error), String(tool).toLowerCase(), String(stage).toLowerCase()].filter(Boolean).join("|");
}

export function summarizeFailureHistory(history = []) {
  const counts = new Map();
  for (const item of Array.isArray(history) ? history : []) {
    const sig = failureSignature(item);
    if (!sig) continue;
    const current = counts.get(sig) || { signature: sig, count: 0, last: null };
    current.count += 1;
    current.last = item;
    counts.set(sig, current);
  }
  return [...counts.values()].sort((a,b) => b.count - a.count);
}

export function decideRetryAction(currentRun = {}, history = [], options = {}) {
  const maxSameFailure = Number.isFinite(Number(options.maxSameFailure)) ? Number(options.maxSameFailure) : 2;
  const maxTotalAttempts = Number.isFinite(Number(options.maxTotalAttempts)) ? Number(options.maxTotalAttempts) : 4;
  const attempts = Math.max(1, Number(currentRun.attempt || 1));
  const sig = failureSignature(currentRun);

  if (!sig) return { action: "continue", reason: "no_failure", signature: null, sameFailureCount: 0 };

  const sameFailureCount = summarizeFailureHistory([...(Array.isArray(history)?history:[]), currentRun])
    .find((x)=>x.signature===sig)?.count || 1;

  if (currentRun.risk_level === "high" || currentRun.risk_level === "blocked") {
    return { action: "escalate", reason: "risk_gate", signature: sig, sameFailureCount };
  }

  if (attempts >= maxTotalAttempts) {
    return { action: "escalate", reason: "attempt_budget_exhausted", signature: sig, sameFailureCount };
  }

  if (sameFailureCount >= maxSameFailure) {
    return {
      action: "replan",
      reason: "repeated_failure_signature",
      signature: sig,
      sameFailureCount,
      constraints: ["do_not_repeat_same_tool_path", "prefer_alternative_strategy"],
    };
  }

  return {
    action: "retry",
    reason: "bounded_retry_allowed",
    signature: sig,
    sameFailureCount,
    constraints: ["same_logical_goal", "no_duplicate_side_effects"],
  };
}

export function buildReplanContext(currentRun = {}, history = []) {
  const decision = decideRetryAction(currentRun, history);
  return {
    decision,
    avoid: summarizeFailureHistory(history)
      .filter((x)=>x.count >= 2)
      .map((x)=>({ signature:x.signature, count:x.count })),
    lastError: currentRun.error || null,
    goal: currentRun.goal || null,
  };
}
