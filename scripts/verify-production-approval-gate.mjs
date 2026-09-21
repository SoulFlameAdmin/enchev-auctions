import fs from "node:fs";

const p = JSON.parse(fs.readFileSync("config/enchev-production-approval-gate.json", "utf8"));

function check(x) {
  const errors = [];
  if (x.taskId !== "26.05") errors.push("taskId");
  if (x.environment !== "production") errors.push("environment");
  if (x.source?.exactShaRequired !== true) errors.push("exactShaRequired");
  if (x.source?.pullRequestEventAllowed !== false) errors.push("pullRequestEventAllowed");
  if (x.approval?.explicitHumanApprovalRequired !== true) errors.push("explicitHumanApprovalRequired");
  if (x.approval?.approvalIdRequired !== true) errors.push("approvalIdRequired");
  if (x.approval?.approverIdentityRequired !== true) errors.push("approverIdentityRequired");
  if (x.approval?.implicitApprovalForbidden !== true) errors.push("implicitApprovalForbidden");
  if (x.preconditions?.requiredQualityGate !== "Verify Enchev Web") errors.push("requiredQualityGate");
  for (const key of ["databaseMigrationGateRequired","buildProvenanceRequired","secretScanRequired","codeScanRequired","sbomRequired"]) {
    if (x.preconditions?.[key] !== true) errors.push(key);
  }
  if (x.deployment?.provider !== "vercel") errors.push("provider");
  if (x.deployment?.requiresGlobalLease !== true) errors.push("requiresGlobalLease");
  if (x.deployment?.leaseOwner !== "ENCHEV_SYSTEM") errors.push("leaseOwner");
  if (x.deployment?.leaseProjectKey !== "enchev-auctions") errors.push("leaseProjectKey");
  if (x.deployment?.leaseSeconds !== 900) errors.push("leaseSeconds");
  if (errors.length) throw new Error("26.05 production approval policy invalid: " + errors.join(","));
}

check(p);

if (process.argv.includes("--self-test")) {
  const mutations = [
    x => { x.source.exactShaRequired = false; },
    x => { x.source.pullRequestEventAllowed = true; },
    x => { x.approval.explicitHumanApprovalRequired = false; },
    x => { x.approval.approvalIdRequired = false; },
    x => { x.approval.approverIdentityRequired = false; },
    x => { x.approval.implicitApprovalForbidden = false; },
    x => { x.preconditions.databaseMigrationGateRequired = false; },
    x => { x.preconditions.buildProvenanceRequired = false; },
    x => { x.deployment.requiresGlobalLease = false; },
    x => { x.deployment.leaseOwner = "OTHER"; }
  ];
  for (const mutate of mutations) {
    const x = structuredClone(p);
    mutate(x);
    let rejected = false;
    try { check(x); } catch { rejected = true; }
    if (!rejected) throw new Error("26.05 negative self-test failed");
  }
  console.log("26.05 PRODUCTION_APPROVAL_GATE_SELF_TEST PASS cases=" + mutations.length);
} else {
  console.log("26.05 PRODUCTION_APPROVAL_GATE PASS status=" + p.status);
}
