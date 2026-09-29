import { summarizeFailureHistory } from "./failure-aware-retry.mjs";

const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));

export function detectWeaknesses({ runs = [], skills = [], benchmark = null } = {}) {
  const weaknesses = [];

  const failures = summarizeFailureHistory(runs);
  for (const f of failures) {
    if (f.count < 2) continue;
    weaknesses.push({
      type: "repeated_failure",
      key: f.signature,
      severity: clamp(0.4 + Math.min(f.count, 6) * 0.1),
      evidence: { count: f.count, last: f.last || null },
      recommendation: "Change strategy/tool path and verify the alternative before reuse.",
    });
  }

  for (const skill of Array.isArray(skills) ? skills : []) {
    const success = Math.max(0, Number(skill.success_count || 0));
    const failure = Math.max(0, Number(skill.failure_count || 0));
    const total = success + failure;
    if (total < 2) continue;
    const reliability = success / total;
    if (reliability >= 0.7) continue;
    weaknesses.push({
      type: "low_skill_reliability",
      key: skill.id || skill.name,
      severity: Number(clamp(1 - reliability).toFixed(4)),
      evidence: { success, failure, reliability, confidence: Number(skill.confidence || 0) },
      recommendation: "Retest or replace the learned procedure before automatic reuse.",
    });
  }

  if (benchmark) {
    if (benchmark.delta?.successRate < 0) {
      weaknesses.push({
        type: "success_regression",
        key: "benchmark_success_rate",
        severity: clamp(Math.abs(benchmark.delta.successRate) + 0.4),
        evidence: benchmark.delta,
        recommendation: "Reject the candidate and isolate the regression cause.",
      });
    }
    if (Number.isFinite(Number(benchmark.delta?.durationImprovementPct)) && benchmark.delta.durationImprovementPct < -10) {
      weaknesses.push({
        type: "performance_regression",
        key: "benchmark_duration",
        severity: clamp(Math.abs(benchmark.delta.durationImprovementPct) / 100),
        evidence: benchmark.delta,
        recommendation: "Profile the candidate and reduce avoidable work before promotion.",
      });
    }
  }

  return weaknesses.sort((a,b)=>b.severity-a.severity);
}

export function chooseUpgradeTarget(weaknesses = [], options = {}) {
  const minSeverity = Number.isFinite(Number(options.minSeverity)) ? Number(options.minSeverity) : 0.55;
  const selected = (Array.isArray(weaknesses)?weaknesses:[]).find(w=>Number(w.severity||0)>=minSeverity) || null;
  if (!selected) return { shouldUpgrade:false, target:null, reason:"no_material_weakness" };
  return { shouldUpgrade:true, target:selected, reason:"material_weakness_detected" };
}

export function buildUpgradeProposal(target, context = {}) {
  if (!target) return null;
  const goal = "Improve DAVID weakness: " + target.type + " (" + target.key + ")";
  return {
    goal,
    weakness: target,
    hypothesis: context.hypothesis || target.recommendation,
    constraints: [
      "modify_only_test_candidate",
      "preserve_current_active_revision",
      "create_backup_before_promotion",
      "require_pass_tests",
      "require_no_regression_benchmark",
      "rollback_on_regression",
    ],
    acceptance: {
      repeatedFailureMustDecrease: target.type === "repeated_failure",
      successRateMustNotRegress: true,
      benchmarkRequired: true,
      artifactHashRequired: true,
    },
  };
}

export function analyzeForSelfUpgrade(input = {}, options = {}) {
  const weaknesses = detectWeaknesses(input);
  const decision = chooseUpgradeTarget(weaknesses, options);
  return {
    weaknesses,
    decision,
    proposal: decision.shouldUpgrade ? buildUpgradeProposal(decision.target, options) : null,
  };
}
