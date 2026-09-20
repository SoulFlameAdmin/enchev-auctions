import fs from "node:fs";

const p = JSON.parse(fs.readFileSync("config/enchev-staging-deployment-policy.json", "utf8"));

function verify(x) {
  const errors = [];
  if (x.deployment?.requiresGlobalLease !== true) errors.push("global lease");
  if (x.deployment?.leaseOwner !== "ENCHEV_SYSTEM") errors.push("owner");
  if (x.deployment?.leaseProjectKey !== "enchev-auctions") errors.push("project");
  if (x.deployment?.leaseSeconds !== 900) errors.push("duration");
  if (x.postDeploy?.requiredState !== "READY") errors.push("terminal provider state");
  if (errors.length) throw new Error("26.06 concurrency invalid: " + errors.join(", "));
}

verify(p);

if (process.argv.includes("--self-test")) {
  const cases = [
    x => { x.deployment.requiresGlobalLease = false; },
    x => { x.deployment.leaseOwner = "OTHER"; },
    x => { x.deployment.leaseProjectKey = "other"; },
    x => { x.deployment.leaseSeconds = 1; }
  ];
  for (const mutate of cases) {
    const candidate = structuredClone(p);
    mutate(candidate);
    let rejected = false;
    try { verify(candidate); } catch { rejected = true; }
    if (!rejected) throw new Error("26.06 negative self-test failed");
  }
  console.log("26.06 DEPLOY_CONCURRENCY_SELF_TEST PASS");
} else {
  console.log("26.06 DEPLOY_CONCURRENCY PASS");
}
