import fs from "node:fs";

const CONFIG_PATH = "config/enchev-deployment-concurrency-control.json";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`DEPLOYMENT_CONCURRENCY_CONTROL FAIL: ${message}`);
}

export function validate(config, workflowText, packageJson, preGateText) {
  if (config?.taskId !== "26.06") fail("taskId must be 26.06");
  if (config?.name !== "Deployment concurrency control") fail("name mismatch");
  if (config?.version !== 1) fail("version must be 1");

  const lease = config.globalLease;
  if (!lease || lease.provider !== "supabase-postgres") fail("global lease provider must be Supabase Postgres");
  if (lease.table !== "public.david_vercel_deploy_lease") fail("lease table drift");
  if (lease.leaseKey !== "global") fail("lease key must be global");
  if (lease.claimFunction !== "public.david_claim_vercel_deploy") fail("claim function drift");
  if (lease.markDeployingFunction !== "public.david_mark_vercel_deploying") fail("mark function drift");
  if (lease.releaseFunction !== "public.david_release_vercel_deploy") fail("release function drift");
  if (lease.blockFunction !== "public.david_block_vercel_deploys") fail("block function drift");
  if (lease.leaseSeconds !== 900) fail("lease duration must remain 900 seconds");

  const requiredFlow = [
    "claim",
    "if-not-granted-no-deploy",
    "mark-deploying",
    "exactly-one-intended-deployment",
    "always-release"
  ];
  if (JSON.stringify(config.requiredFlow) !== JSON.stringify(requiredFlow)) fail("required flow drift");

  for (const key of [
    "noDeployWithoutLease",
    "noParallelManualDeploys",
    "quotaRetryTimeMustComeFromProvider",
    "releaseRequiredOnSuccessOrFailure",
    "productionAndPreviewShareGlobalLease"
  ]) {
    if (config.safety?.[key] !== true) fail(`safety invariant disabled: ${key}`);
  }

  if (!workflowText.includes("concurrency:")) fail("verification workflow lost concurrency block");
  if (!workflowText.includes("group: verify-enchev-web-${{ github.ref }}")) fail("verification concurrency group drift");
  if (!workflowText.includes("cancel-in-progress: true")) fail("verification workflow must cancel superseded runs");
  if (!workflowText.includes("Deployment concurrency control contract (26.06)")) fail("workflow must execute 26.06 verifier");

  if (packageJson?.scripts?.["verify:deployment-concurrency-control"] !== "node scripts/verify-deployment-concurrency-control.mjs") {
    fail("package verify script drift");
  }
  if (packageJson?.scripts?.["verify:deployment-concurrency-control:self-test"] !== "node scripts/verify-deployment-concurrency-control.mjs --self-test") {
    fail("package self-test script drift");
  }
  if (!preGateText.includes('["scripts/verify-deployment-concurrency-control.mjs", "--self-test"]')) {
    fail("26.06 self-test must be registered in system pre-gates");
  }

  return { taskId: config.taskId, leaseSeconds: lease.leaseSeconds };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const workflowText = fs.readFileSync(WORKFLOW_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateText = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, workflowText, packageJson, preGateText);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const c = structuredClone(config);
    let w = workflowText;
    let p = structuredClone(packageJson);
    let g = preGateText;
    ({ config: c, workflowText: w, packageJson: p, preGateText: g } = mutate({ config: c, workflowText: w, packageJson: p, preGateText: g }) || { config: c, workflowText: w, packageJson: p, preGateText: g });
    let rejected = false;
    try { validate(c, w, p, g); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("deploy allowed without lease", x => { x.config.safety.noDeployWithoutLease = false; return x; });
  reject("release not required", x => { x.config.safety.releaseRequiredOnSuccessOrFailure = false; return x; });
  reject("retry time may be invented", x => { x.config.safety.quotaRetryTimeMustComeFromProvider = false; return x; });
  reject("lease duration drift", x => { x.config.globalLease.leaseSeconds = 60; return x; });
  reject("workflow concurrency removed", x => { x.workflowText = x.workflowText.replace(/concurrency:[\s\S]*?jobs:/m, "jobs:"); return x; });
  reject("pre-gate registration removed", x => { x.preGateText = x.preGateText.replace('["scripts/verify-deployment-concurrency-control.mjs", "--self-test"],\n', ""); return x; });

  console.log(`DEPLOYMENT_CONCURRENCY_CONTROL_SELF_TEST PASS cases=${cases} fail_closed=true`);
} else {
  console.log(`DEPLOYMENT_CONCURRENCY_CONTROL PASS task=${result.taskId} lease_seconds=${result.leaseSeconds} global_lease=true`);
}
