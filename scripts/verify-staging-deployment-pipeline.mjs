import fs from "node:fs";

const p = JSON.parse(fs.readFileSync("config/enchev-staging-deployment-policy.json", "utf8"));

function check(x) {
  const errors = [];
  if (x.taskId !== "26.04") errors.push("taskId");
  if (x.environment !== "staging") errors.push("environment");
  if (x.source?.exactShaRequired !== true) errors.push("exactShaRequired");
  if (x.deployment?.provider !== "vercel") errors.push("provider");
  if (x.deployment?.requiresGlobalLease !== true) errors.push("requiresGlobalLease");
  if (x.deployment?.leaseOwner !== "ENCHEV_SYSTEM") errors.push("leaseOwner");
  if (x.deployment?.leaseProjectKey !== "enchev-auctions") errors.push("leaseProjectKey");
  if (x.deployment?.leaseSeconds !== 900) errors.push("leaseSeconds");
  if (x.postDeploy?.requiredState !== "READY") errors.push("requiredState");
  if (x.postDeploy?.smokePath !== "/api/health/web") errors.push("smokePath");
  if (errors.length) throw new Error("26.04 policy invalid: " + errors.join(","));
}

check(p);

if (process.argv.includes("--self-test")) {
  const fields = [
    x => { x.source.exactShaRequired = false; },
    x => { x.deployment.requiresGlobalLease = false; },
    x => { x.deployment.leaseOwner = "OTHER"; },
    x => { x.deployment.leaseProjectKey = "other"; },
    x => { x.postDeploy.requiredState = "OTHER"; },
    x => { x.postDeploy.smokePath = "/"; }
  ];
  for (const mutate of fields) {
    const x = structuredClone(p);
    mutate(x);
    let rejected = false;
    try { check(x); } catch { rejected = true; }
    if (!rejected) throw new Error("26.04 negative self-test failed");
  }
  console.log("26.04 STAGING_PIPELINE_SELF_TEST PASS");
} else {
  console.log("26.04 STAGING_PIPELINE PASS status=" + p.status);
}
