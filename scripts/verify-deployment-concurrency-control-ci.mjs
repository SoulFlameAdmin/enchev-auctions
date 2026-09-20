import fs from "node:fs";

const CONFIG_PATH = "config/enchev-deployment-concurrency-control.json";
const VERIFY_WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";

function fail(message) {
  throw new Error(`DEPLOYMENT_CONCURRENCY_CONTROL_CI FAIL: ${message}`);
}

export function validate(config, workflowText) {
  if (config?.taskId !== "26.06") fail("taskId must be 26.06");
  if (config?.name !== "Deployment concurrency control") fail("name mismatch");
  if (config?.version !== 1) fail("version must be 1");

  const lease = config.globalLease;
  if (!lease || lease.provider !== "supabase-postgres") fail("lease provider drift");
  if (lease.table !== "public.david_vercel_deploy_lease") fail("lease table drift");
  if (lease.leaseKey !== "global") fail("lease key drift");
  if (lease.claimFunction !== "public.david_claim_vercel_deploy") fail("claim function drift");
  if (lease.markDeployingFunction !== "public.david_mark_vercel_deploying") fail("mark function drift");
  if (lease.releaseFunction !== "public.david_release_vercel_deploy") fail("release function drift");
  if (lease.blockFunction !== "public.david_block_vercel_deploys") fail("block function drift");
  if (lease.leaseSeconds !== 900) fail("lease seconds drift");

  const expectedFlow = [
    "claim",
    "if-not-granted-no-deploy",
    "mark-deploying",
    "exactly-one-intended-deployment",
    "always-release"
  ];
  if (JSON.stringify(config.requiredFlow) !== JSON.stringify(expectedFlow)) fail("required flow drift");

  for (const key of [
    "noDeployWithoutLease",
    "noParallelManualDeploys",
    "quotaRetryTimeMustComeFromProvider",
    "releaseRequiredOnSuccessOrFailure",
    "productionAndPreviewShareGlobalLease"
  ]) {
    if (config.safety?.[key] !== true) fail(`safety invariant disabled: ${key}`);
  }

  if (!workflowText.includes("concurrency:")) fail("canonical verification workflow lost concurrency block");
  if (!workflowText.includes("group: verify-enchev-web-${{ github.ref }}")) fail("canonical verification concurrency group drift");
  if (!workflowText.includes("cancel-in-progress: true")) fail("canonical verification workflow must cancel superseded runs");

  return { taskId: config.taskId, leaseSeconds: lease.leaseSeconds };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const workflowText = fs.readFileSync(VERIFY_WORKFLOW_PATH, "utf8");
const result = validate(config, workflowText);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutateConfig, mutateWorkflow) => {
    const c = structuredClone(config);
    let w = workflowText;
    mutateConfig?.(c);
    if (mutateWorkflow) w = mutateWorkflow(w);
    let rejected = false;
    try { validate(c, w); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("deploy allowed without lease", c => { c.safety.noDeployWithoutLease = false; });
  reject("release not required", c => { c.safety.releaseRequiredOnSuccessOrFailure = false; });
  reject("retry time may be invented", c => { c.safety.quotaRetryTimeMustComeFromProvider = false; });
  reject("parallel deploys allowed", c => { c.safety.noParallelManualDeploys = false; });
  reject("lease duration drift", c => { c.globalLease.leaseSeconds = 60; });
  reject("workflow concurrency removed", null, w => w.replace(/concurrency:[\s\S]*?jobs:/m, "jobs:"));

  console.log(`DEPLOYMENT_CONCURRENCY_CONTROL_CI_SELF_TEST PASS cases=${cases} fail_closed=true`);
} else {
  console.log(`DEPLOYMENT_CONCURRENCY_CONTROL_CI PASS task=${result.taskId} lease_seconds=${result.leaseSeconds} global_lease=true`);
}
