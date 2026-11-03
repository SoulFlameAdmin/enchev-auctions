import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const source = "packages/domain/src/platform-legal-role-lifecycle.ts";
const root = "packages/domain/src/platform-legal-role.ts";
const index = fs.readFileSync("packages/domain/src/index.ts", "utf8");
assert.ok(index.includes('export * from "./platform-legal-role-lifecycle";'), "lifecycle export missing");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-role-lifecycle-"));
function reject(fn, code) {
  assert.throws(fn, (error) => error instanceof Error && error.message === code, code);
}
try {
  const tsc = path.resolve("node_modules/typescript/bin/tsc");
  const result = spawnSync(process.execPath, [
    tsc, root, source, "--ignoreConfig", "--target", "ES2022", "--module", "ES2022",
    "--moduleResolution", "Bundler", "--skipLibCheck", "--outDir", temp, "--pretty", "false",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, "compile failed: " + (result.stderr || result.stdout));
  const d = await import(pathToFileURL(path.join(temp, "platform-legal-role-lifecycle.js")).href);
  const role = await import(pathToFileURL(path.join(temp, "platform-legal-role.js")).href);
  const base = {
    recordId: "legal-role-001",
    operatorEntityId: "operator-001",
    marketCountry: "BG",
    roleCode: "auction-operator",
    status: "draft",
    contractReference: null,
    legalReviewReference: null,
    effectiveFrom: "2026-10-22T00:00:00.000Z",
    effectiveUntil: "2027-10-22T00:00:00.000Z",
    revision: 0,
  };
  const cmd = (action, expectedRevision) => ({
    action, actorId: "reviewer-001", expectedRevision,
    occurredAt: "2026-10-23T11:00:00.000Z", reason: "Verified lifecycle review",
  });

  const submitted = d.transitionPlatformLegalRole(base, cmd("submit-review", 0));
  assert.equal(submitted.record.status, "under-review");
  assert.equal(submitted.record.revision, 1);
  assert.equal(submitted.audit.previousStatus, "draft");
  assert.equal(submitted.audit.nextStatus, "under-review");
  assert.equal(submitted.audit.eventId, "legal-role-001:1");
  assert.ok(Object.isFrozen(submitted.record) && Object.isFrozen(submitted.audit));
  assert.equal(base.status, "draft", "input must remain untouched");

  const approved = d.transitionPlatformLegalRole(submitted.record, {
    ...cmd("approve", 1),
    approvalEvidence: { contractReference: "contract:001", legalReviewReference: "legal:001" },
  });
  assert.equal(approved.record.status, "approved");
  assert.equal(approved.record.revision, 2);
  assert.equal(role.findApprovedPlatformLegalRole(
    [approved.record], "operator-001", "BG", "auction-operator", "2026-11-01T00:00:00.000Z",
  )?.recordId, "legal-role-001");

  const suspended = d.transitionPlatformLegalRole(approved.record, cmd("suspend", 2));
  assert.equal(suspended.record.status, "suspended");
  assert.equal(role.findApprovedPlatformLegalRole(
    [suspended.record], "operator-001", "BG", "auction-operator", "2026-11-01T00:00:00.000Z",
  ), null, "suspension must prevent role resolution");

  const reopened = d.transitionPlatformLegalRole(suspended.record, cmd("reopen-review", 3));
  const returned = d.transitionPlatformLegalRole(reopened.record, cmd("request-changes", 4));
  assert.equal(returned.record.status, "draft");
  assert.equal(returned.record.revision, 5);

  reject(() => d.transitionPlatformLegalRole(base, cmd("approve", 0)), "PLATFORM_ROLE_TRANSITION_NOT_ALLOWED");
  reject(() => d.transitionPlatformLegalRole(base, cmd("not-an-action", 0)), "PLATFORM_ROLE_TRANSITION_ACTION_INVALID");
  reject(() => d.transitionPlatformLegalRole(base, cmd("toString", 0)), "PLATFORM_ROLE_TRANSITION_ACTION_INVALID");
  reject(() => d.transitionPlatformLegalRole(base, cmd("submit-review", 2)), "PLATFORM_ROLE_TRANSITION_REVISION_CONFLICT");
  reject(() => d.transitionPlatformLegalRole(base, { ...cmd("submit-review", 0), actorId: "" }),
    "PLATFORM_ROLE_TRANSITION_ACTOR_REQUIRED");
  reject(() => d.transitionPlatformLegalRole(base, { ...cmd("submit-review", 0), reason: "" }),
    "PLATFORM_ROLE_TRANSITION_REASON_REQUIRED");
  reject(() => d.transitionPlatformLegalRole(base, { ...cmd("submit-review", 0), occurredAt: "2026-10-22" }),
    "PLATFORM_ROLE_TRANSITION_TIME_INVALID");
  reject(() => d.transitionPlatformLegalRole(base, { ...cmd("submit-review", 0),
    approvalEvidence: { contractReference: "x", legalReviewReference: "x" } }),
    "PLATFORM_ROLE_TRANSITION_UNEXPECTED_EVIDENCE");
  reject(() => d.transitionPlatformLegalRole(submitted.record, { ...cmd("approve", 1) }),
    "PLATFORM_ROLE_TRANSITION_CONTRACT_REQUIRED");
  reject(() => d.transitionPlatformLegalRole(submitted.record, { ...cmd("approve", 1),
    approvalEvidence: { contractReference: "contract:001", legalReviewReference: "" } }),
    "PLATFORM_ROLE_TRANSITION_LEGAL_REVIEW_REQUIRED");
  reject(() => d.transitionPlatformLegalRole(approved.record, cmd("approve", 2)),
    "PLATFORM_ROLE_TRANSITION_NOT_ALLOWED");
  console.log("ENCHEV_ETAP2_SYSTEM_63_02 PASS workflow_positive=5 negative=11");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
