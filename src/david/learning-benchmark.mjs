const safeNum=(v)=>Number.isFinite(Number(v))?Number(v):null;
const pct=(before,after)=> before>0 ? ((before-after)/before)*100 : null;

export function summarizeRuns(runs = []) {
  const list = Array.isArray(runs)?runs:[];
  const completed=list.filter(r=>["completed","success","passed","green"].includes(String(r.status||"").toLowerCase())).length;
  const failed=list.filter(r=>["failed","error","red"].includes(String(r.status||"").toLowerCase())).length;
  const durations=list.map(r=>safeNum(r.durationMs)).filter(v=>v!==null);
  const actions=list.map(r=>safeNum(r.actionCount)).filter(v=>v!==null);
  return {
    total:list.length,
    completed,
    failed,
    successRate:list.length?completed/list.length:0,
    avgDurationMs:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,
    avgActionCount:actions.length?actions.reduce((a,b)=>a+b,0)/actions.length:null,
  };
}

export function comparePerformance(beforeRuns=[], afterRuns=[]) {
  const before=summarizeRuns(beforeRuns);
  const after=summarizeRuns(afterRuns);
  return {
    before, after,
    delta:{
      successRate: after.successRate-before.successRate,
      durationImprovementPct:
        before.avgDurationMs!==null && after.avgDurationMs!==null ? pct(before.avgDurationMs,after.avgDurationMs):null,
      actionReductionPct:
        before.avgActionCount!==null && after.avgActionCount!==null ? pct(before.avgActionCount,after.avgActionCount):null,
      failureReduction: before.failed-after.failed,
    }
  };
}

export function benchmarkVerdict(comparison, thresholds={}) {
  const minSuccessDelta = thresholds.minSuccessDelta ?? 0;
  const minDurationImprovementPct = thresholds.minDurationImprovementPct ?? 0;
  const successOk = comparison.delta.successRate >= minSuccessDelta;
  const duration = comparison.delta.durationImprovementPct;
  const durationOk = duration === null ? true : duration >= minDurationImprovementPct;
  const noRegression = comparison.after.successRate >= comparison.before.successRate;
  return {
    pass: Boolean(successOk && durationOk && noRegression),
    successOk,
    durationOk,
    noRegression,
  };
}
