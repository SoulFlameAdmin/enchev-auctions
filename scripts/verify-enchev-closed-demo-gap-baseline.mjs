#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportFile = path.join(root, "config/enchev-closed-demo-gap-baseline-v1.json");
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const overlay = fs.readFileSync(path.join(root, report.missionSource), "utf8");

function fail(message) { throw new Error("ENCHEV_CLOSED_DEMO_MISSION001 FAIL: " + message); }

const ids = [...overlay.matchAll(/^### (MISSION-\d{3}) — /gm)].map((m) => m[1]);
const expected = Array.from({ length: 35 }, (_, i) => "MISSION-" + String(i + 1).padStart(3, "0"));

function validate(baseline) {
  if (JSON.stringify(ids) !== JSON.stringify(expected)) fail("overlay source mission identifiers drift");
  if (baseline.schema !== "enchev.closed-demo-gap-baseline.v1") fail("baseline schema mismatch");
  if (baseline.missionSource !== "docs/URGENT_DAVID_AGI_ENCHEV_CLOSED_DEMO_V1.md") fail("mission source changed");
  if (!/^[a-f0-9]{40}$/.test(baseline.mainCommit)) fail("source commit must be 40-character SHA");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseline.observedAt)) fail("observation date missing");
  if (baseline.nonProduction !== true) fail("demo must be explicitly nonproduction");
  if (!Array.isArray(baseline.steps) || baseline.steps.length !== expected.length) fail("all 35 mission steps must be present");
  if (!Array.isArray(baseline.releaseGates)) fail("release gates absent");
  const mandatoryGates = ["MISSION-024", "MISSION-026", "MISSION-028", "MISSION-033", "MISSION-034", "MISSION-035"];
  if (JSON.stringify(baseline.releaseGates) !== JSON.stringify(mandatoryGates)) fail("release-gate identity drift");
  const statuses = new Set(["partial", "unverified", "external"]);
  const allowedMappedSystemIds = new Set(["35.01", "35.02", "35.03", "35.04", "37.02", "37.03", "37.04"]);
  for (const [i, step] of baseline.steps.entries()) {
    if (step.id !== expected[i]) fail("missing/duplicated/reordered mission step at " + i);
    if (!statuses.has(step.status)) fail("a baseline checkpoint cannot assert GREEN/complete or unknown status for " + step.id);
    if (typeof step.blocker !== "string" || step.blocker.trim().length < 25) fail("missing meaningful blocker for " + step.id);
    if (!Array.isArray(step.evidence) || !Array.isArray(step.mappedSystemTaskIds)) fail("evidence/task IDs must be arrays for " + step.id);
    if (step.status === "partial" && step.evidence.length === 0) fail("partial needs code/data evidence for " + step.id);
    if (step.evidence.some((url) => typeof url !== "string" || !/^https:\/\/(github\.com|supabase\.com|vercel\.com)\//.test(url))) fail("unapproved evidence URL for " + step.id);
    if (step.mappedSystemTaskIds.some((id) => !allowedMappedSystemIds.has(id))) fail("unverified mapping to immutable SYSTEM task for " + step.id);
  }
  if (baseline.steps[23].status === "external" || baseline.steps[27].status === "external") fail("critical no-release/single-use gates need executable acceptance, not external sign-off");
  if (typeof baseline.nextAction !== "string" || !baseline.nextAction.startsWith("MISSION-002:")) fail("first actionable dependent work must be MISSION-002");
}

validate(report);

if (process.argv.includes("--self-test")) {
  const negative = (label, mutator) => {
    const modified = structuredClone(report);
    mutator(modified);
    let rejected = false;
    try { validate(modified); } catch { rejected = true; }
    if (!rejected) fail("negative fixture unexpectedly accepted: " + label);
  };
  negative("missing mission", (x) => { x.steps.pop(); });
  negative("mission identity order", (x) => { x.steps[2].id = "MISSION-004"; });
  negative("unsafe green", (x) => { x.steps[0].status = "green"; });
  negative("unverified task mapping", (x) => { x.steps[3].mappedSystemTaskIds.push("63.99"); });
  negative("missing production boundary", (x) => { x.nonProduction = false; });
  negative("missing release gate", (x) => { x.releaseGates.splice(0,1); });
  negative("missing partial evidence", (x) => { x.steps[2].evidence = []; });
  negative("missing blocker", (x) => { x.steps[5].blocker = ""; });
  negative("wrong next action", (x) => { x.nextAction = "MISSION-035"; });
}

const totals = Object.fromEntries([...new Set(report.steps.map((x) => x.status))].map((status) => [status, report.steps.filter((x) => x.status === status).length]));
console.log("ENCHEV_CLOSED_DEMO_MISSION001 BASELINE PASS — steps=" + report.steps.length + " statusCount=" + JSON.stringify(totals) + "; GREEN claims=0; next=MISSION-002");
