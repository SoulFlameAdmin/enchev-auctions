import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validatePremiumTokens(css, layout) {
  const requiredTokens = [
    "--ea-canvas",
    "--ea-surface-1",
    "--ea-surface-2",
    "--ea-border-default",
    "--ea-brand",
    "--ea-action-primary",
    "--ea-state-live",
    "--ea-state-info",
    "--ea-state-success",
    "--ea-state-warning",
    "--ea-state-danger",
    "--ea-state-sold",
    "--ea-elevation-1",
    "--ea-radius-control",
    "--ea-radius-card",
    "--ea-focus-ring"
  ];
  for (const token of requiredTokens) {
    assert(css.includes(`${token}:`), `DP2-02 missing premium token ${token}`);
  }

  const routeCoverage = [".eaHome", ".inventoryPage", ".lotPage", ".livePage", ".navigationPage"];
  for (const selector of routeCoverage) {
    assert(css.includes(selector), `DP2-02 token layer missing buyer-route coverage for ${selector}`);
  }

  assert(css.includes("var(--ea-state-live)"), "DP2-02 must map LIVE to a dedicated state token");
  assert(css.includes("var(--ea-action-primary)"), "DP2-02 must map primary actions to an action token");
  assert(css.includes("var(--ea-border-default)"), "DP2-02 must use neutral semantic borders");
  assert(layout.includes('import "./dp2-design-tokens.css";'), "Root layout must import DP2 design tokens");
}

function validateEvidence(data) {
  assert(data && data.version === "2.0", "DP2 evidence version must be 2.0");
  assert(data.status === "active", "DP2 evidence status must be active");
  assert(data.plan === "docs/DESIGN_PROCESS_2.md", "DP2 evidence must point to DESIGN_PROCESS_2.md");
  assert(Array.isArray(data.tasks), "DP2 tasks must be an array");
  assert(data.tasks.length === 30, `DP2 must contain exactly 30 tasks, found ${data.tasks.length}`);

  const expected = Array.from({length:30},(_,i)=>`DP2-${String(i+1).padStart(2,"0")}`);
  const ids = data.tasks.map(task=>String(task.id||""));
  assert(JSON.stringify(ids) === JSON.stringify(expected), "DP2 IDs/order must be exactly DP2-01 -> DP2-30");
  assert(new Set(ids).size === ids.length, "DP2 task IDs must be unique");

  for (const task of data.tasks) {
    assert(["green","yellow","red"].includes(String(task.status)), `${task.id}: invalid status`);
    assert(String(task.group||"").trim(), `${task.id}: missing group`);
    assert(String(task.title||"").trim(), `${task.id}: missing title`);
    if (task.status === "green") {
      assert(String(task.evidence||"").trim(), `${task.id}: GREEN requires evidence`);
    }
  }
}

function validateRepository() {
  const evidence = JSON.parse(read("app/design-process-2-evidence.json"));
  validateEvidence(evidence);

  const premiumTokens = read("app/dp2-design-tokens.css");
  const rootLayout = read("app/layout.tsx");
  validatePremiumTokens(premiumTokens, rootLayout);

  const plan = read("docs/DESIGN_PROCESS_2.md");
  assert(plan.includes("DP2-01") && plan.includes("DP2-30"), "DP2 plan must define DP2-01 and DP2-30");
  assert(plan.includes("Do not invent DP2-31") || plan.includes("Do not invent DP2-31 automatically"), "DP2 plan must forbid automatic DP2-31 scope growth");

  const menu = read("app/components/MasterSystemPlanV1.tsx");
  assert(menu.includes("Design Process 2"), "Enchev command-center menu must expose Design Process 2");
  assert(menu.includes("<DesignProcess2"), "Enchev command center must render the DesignProcess2 panel");

  const panel = read("app/components/DesignProcess2.tsx");
  assert(panel.includes("../design-process-2-evidence.json"), "Design Process 2 panel must read the canonical evidence tracker");
  assert(panel.includes('data-design-process="2"'), "Design Process 2 panel marker missing");

  const worker = read("tools/david/auto-continue-design-v1.mjs");
  assert(worker.includes("docs/DESIGN_PROCESS_2.md"), "DESIGN worker must target DESIGN_PROCESS_2.md");
  assert(worker.includes("design-process-2-evidence.json"), "DESIGN worker must target Process 2 evidence");
  assert(worker.includes("DP2-01") && worker.includes("DP2-30"), "DESIGN worker must enforce DP2 execution range");
  assert(worker.includes("[DAVID_RELAY_ENCHEV_DESIGN_PROCESS_2]"), "DESIGN worker Process 2 marker missing");

  const supervisor = read("tools/david/dual-session-worker.mjs");
  assert(supervisor.includes("DAVID_RELAY_ENCHEV_DESIGN_PROCESS_2"), "Supervisor must recognize Process 2 DESIGN marker");

  const dashboard = read("tools/david/david-status-dashboard.ps1");
  assert(dashboard.includes("design-process-2-evidence.json"), "Matrix must read Process 2 evidence");
  assert(dashboard.includes('Name="DESIGN2"'), "Matrix must label Process 2 progress as DESIGN2");

  const start = read("START_DAVID_ALL.ps1");
  assert(start.includes("ENCHEV DESIGN PROCESS 2"), "Startup summary must expose ENCHEV DESIGN PROCESS 2");

  console.log("DESIGN_PROCESS_2_INVARIANT PASS tasks=30 menu=1 worker=1 matrix=1");
}

function selfTest() {
  const good = {
    version:"2.0",
    status:"active",
    plan:"docs/DESIGN_PROCESS_2.md",
    tasks:Array.from({length:30},(_,i)=>({
      id:`DP2-${String(i+1).padStart(2,"0")}`,
      group:"G",
      title:"T",
      status:"red",
      evidence:""
    }))
  };
  validateEvidence(good);

  const broken = structuredClone(good);
  broken.tasks[1].id = "DP2-01";
  let rejected = false;
  try { validateEvidence(broken); } catch { rejected = true; }
  assert(rejected, "DP2 self-test must reject duplicate/out-of-order IDs");

  const greenWithoutEvidence = structuredClone(good);
  greenWithoutEvidence.tasks[0].status = "green";
  rejected = false;
  try { validateEvidence(greenWithoutEvidence); } catch { rejected = true; }
  assert(rejected, "DP2 self-test must reject GREEN without evidence");

  const requiredPremiumTokens = [
    "--ea-canvas","--ea-surface-1","--ea-surface-2","--ea-border-default",
    "--ea-brand","--ea-action-primary","--ea-state-live","--ea-state-info",
    "--ea-state-success","--ea-state-warning","--ea-state-danger","--ea-state-sold",
    "--ea-elevation-1","--ea-radius-control","--ea-radius-card","--ea-focus-ring"
  ];
  const tokenFixture =
    `:root{${requiredPremiumTokens.map(token=>`${token}:x;`).join("")}}` +
    ".eaHome,.inventoryPage,.lotPage,.livePage,.navigationPage{}" +
    ".live{color:var(--ea-state-live);border:var(--ea-border-default);background:var(--ea-action-primary)}";
  validatePremiumTokens(tokenFixture, 'import "./dp2-design-tokens.css";');

  rejected = false;
  try {
    validatePremiumTokens(tokenFixture.replace("--ea-state-live:x;", ""), 'import "./dp2-design-tokens.css";');
  } catch {
    rejected = true;
  }
  assert(rejected, "DP2 self-test must reject a missing semantic LIVE token");

  console.log("DESIGN_PROCESS_2_SELF_TEST PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else validateRepository();
