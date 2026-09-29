import { benchmarkVerdict } from "./learning-benchmark.mjs";

export function buildUpgradeTestMatrix(candidatePackage = {}, options = {}) {
  const changes=Array.isArray(candidatePackage.changes)?candidatePackage.changes:[];
  const tests=[
    {id:"unit",required:true},
    {id:"integration",required:true},
    {id:"regression",required:true},
    {id:"benchmark",required:true},
  ];
  if (changes.some(c=>c.risk==="medium" || c.risk==="high")) tests.push({id:"safety",required:true});
  if (options.includeCompatibility) tests.push({id:"compatibility",required:true});
  return tests;
}

export function evaluateUpgradeTestMatrix(matrix = [], results = {}, benchmark = null, thresholds = {}) {
  const checks=[];
  for (const test of Array.isArray(matrix)?matrix:[]) {
    const result=results[test.id];
    const passed=Boolean(result && result.status==="passed");
    checks.push({id:test.id,required:test.required!==false,passed,detail:result || null});
  }
  const requiredFailed=checks.filter(c=>c.required && !c.passed);
  let benchmarkCheck=null;
  if (matrix.some(t=>t.id==="benchmark")) {
    benchmarkCheck=benchmark ? benchmarkVerdict(benchmark,thresholds) : {pass:false};
    if (!benchmarkCheck.pass && !requiredFailed.some(c=>c.id==="benchmark")) requiredFailed.push({id:"benchmark",required:true,passed:false,detail:benchmarkCheck});
  }
  return { pass:requiredFailed.length===0, checks, benchmark:benchmarkCheck, failures:requiredFailed };
}

export function buildTestRunRecord(candidate, evaluation, context = {}) {
  return {
    candidate_id:candidate.id,
    user_id:candidate.user_id,
    runner:context.runner || "DAVID_SELF_UPGRADE_TEST_MATRIX_V1",
    status:evaluation.pass ? "passed" : "failed",
    results:evaluation.checks,
    artifact_sha256:context.artifactSha256 || candidate.artifact_sha256 || null,
  };
}
