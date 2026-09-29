export function validateProposal(proposal = {}) {
  const errors=[];
  if (!proposal.goal || String(proposal.goal).trim().length < 10) errors.push("proposal_goal_required");
  if (!proposal.weakness) errors.push("weakness_required");
  if (!proposal.hypothesis) errors.push("hypothesis_required");
  if (!proposal.acceptance?.benchmarkRequired) errors.push("benchmark_requirement_missing");
  return { valid: errors.length===0, errors };
}

export function classifyChangeRisk(change = {}) {
  const path=String(change.path || "").replace(/\\/g,"/").toLowerCase();
  const op=String(change.operation || "modify").toLowerCase();
  if (path.startsWith("tools/david/") || ["start_david_all.ps1","stop_david_all_clean.ps1","restart_david_all_clean.ps1"].includes(path)) return "blocked";
  if (path.includes("auth") || path.includes("billing") || path.includes("secrets") || path.includes("production")) return "high";
  if (op==="delete" || op==="rename") return "high";
  if (path.startsWith("src/david/") || path.startsWith("scripts/") || path.startsWith("docs/")) return "low";
  return "medium";
}

export function buildCandidatePackage(proposal, changes = [], context = {}) {
  const validation=validateProposal(proposal);
  if (!validation.valid) throw new Error(validation.errors.join(","));
  const normalized=(Array.isArray(changes)?changes:[]).map((change,index)=>({
    id: change.id || "change-"+(index+1),
    operation: change.operation || "modify",
    path: String(change.path || "").replace(/\\/g,"/"),
    description: change.description || "",
    risk: classifyChangeRisk(change),
  }));
  const blocked=normalized.filter(c=>c.risk==="blocked");
  if (blocked.length) return { allowed:false, reason:"protected_runtime_change", blocked, changes:normalized };
  return {
    allowed:true,
    version:1,
    proposal,
    changes:normalized,
    sandbox:{
      branch:context.branch || null,
      workspace:context.workspace || "candidate",
      baseRevision:context.baseRevision || null,
      backupRef:context.backupRef || null,
    },
    testRequirements:["unit","integration","regression","benchmark"],
    promotionRequires:["backup_ref","artifact_sha256","test_pass","benchmark_pass"],
  };
}

export function candidateReadyForTesting(pkg = {}) {
  const reasons=[];
  if (!pkg.allowed) reasons.push(pkg.reason || "candidate_not_allowed");
  if (!pkg.sandbox?.baseRevision) reasons.push("base_revision_required");
  if (!pkg.sandbox?.backupRef) reasons.push("backup_ref_required");
  if (!Array.isArray(pkg.changes) || pkg.changes.length===0) reasons.push("changes_required");
  if (pkg.changes?.some(c=>c.risk==="blocked")) reasons.push("blocked_change_present");
  return { ready:reasons.length===0, reasons };
}
