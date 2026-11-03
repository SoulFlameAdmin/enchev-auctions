import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const SOURCE = "packages/domain/src/platform-legal-role.ts";
const INDEX = "packages/domain/src/index.ts";

function fails(fn, code) {
  assert.throws(fn, error => error instanceof Error && error.message === code, code);
}

const index = fs.readFileSync(INDEX, "utf8");
assert.ok(index.includes('export * from "./platform-legal-role";'), "domain export missing");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-commercial-role-"));
try {
  const tsc = path.resolve("node_modules/typescript/bin/tsc");
  const run = spawnSync(process.execPath, [
    tsc, SOURCE, "--ignoreConfig", "--target", "ES2022", "--module", "ES2022",
    "--moduleResolution", "Bundler", "--skipLibCheck", "--outDir", temp, "--pretty", "false",
  ], { encoding: "utf8" });
  assert.equal(run.status, 0, "compile failed: " + (run.stderr || run.stdout));
  const domain = await import(pathToFileURL(path.join(temp, "platform-legal-role.js")).href);

  const base = {
    recordId: "role-001",
    operatorEntityId: "enchev-entity",
    marketCountry: "BG",
    roleCode: "auction-operator",
    status: "approved",
    contractReference: "contract:2026-001",
    legalReviewReference: "legal:review-001",
    effectiveFrom: "2026-10-22T00:00:00.000Z",
    effectiveUntil: "2027-10-22T00:00:00.000Z",
    revision: 1,
  };
  const normalized = domain.normalizePlatformLegalRole(base);
  assert.ok(Object.isFrozen(normalized));
  assert.notEqual(normalized, base, "normalize must return a new immutable snapshot");

  const approved = domain.findApprovedPlatformLegalRole(
    [base], "enchev-entity", "BG", "auction-operator", "2026-11-01T12:00:00.000Z",
  );
  assert.equal(approved?.recordId, "role-001");
  assert.equal(domain.findApprovedPlatformLegalRole(
    [base], "enchev-entity", "ES", "auction-operator", "2026-11-01T12:00:00.000Z",
  ), null, "country isolation");
  assert.equal(domain.findApprovedPlatformLegalRole(
    [base], "other-entity", "BG", "auction-operator", "2026-11-01T12:00:00.000Z",
  ), null, "entity isolation");
  assert.equal(domain.findApprovedPlatformLegalRole(
    [base], "enchev-entity", "BG", "seller-of-record", "2026-11-01T12:00:00.000Z",
  ), null, "role isolation");
  assert.equal(domain.findApprovedPlatformLegalRole(
    [base], "enchev-entity", "BG", "auction-operator", "2027-10-22T00:00:00.000Z",
  ), null, "end time must be exclusive");
  assert.equal(domain.findApprovedPlatformLegalRole(
    [{ ...base, status: "under-review", contractReference: null, legalReviewReference: null }],
    "enchev-entity", "BG", "auction-operator", "2026-11-01T12:00:00.000Z",
  ), null, "draft legal status must not grant an approved role");

  fails(() => domain.normalizePlatformLegalRole({ ...base, legalReviewReference: null }),
    "PLATFORM_ROLE_APPROVAL_EVIDENCE_REQUIRED");
  fails(() => domain.normalizePlatformLegalRole({ ...base, contractReference: null }),
    "PLATFORM_ROLE_APPROVAL_EVIDENCE_REQUIRED");
  fails(() => domain.normalizePlatformLegalRole({ ...base, marketCountry: "GBR" }),
    "PLATFORM_ROLE_COUNTRY_INVALID");
  fails(() => domain.normalizePlatformLegalRole({ ...base, roleCode: "" }),
    "PLATFORM_ROLE_CODE_INVALID");
  fails(() => domain.normalizePlatformLegalRole({ ...base, status: "imaginary" }),
    "PLATFORM_ROLE_STATUS_INVALID");
  fails(() => domain.normalizePlatformLegalRole({ ...base, revision: -1 }),
    "PLATFORM_ROLE_REVISION_INVALID");
  fails(() => domain.normalizePlatformLegalRole({ ...base, effectiveUntil: base.effectiveFrom }),
    "PLATFORM_ROLE_DATE_RANGE_INVALID");
  fails(() => domain.normalizePlatformLegalRole({ ...base, effectiveFrom: "2026-10-22" }),
    "PLATFORM_ROLE_START_INVALID");
  fails(() => domain.findApprovedPlatformLegalRole(
    [base, { ...base, recordId: "role-002" }],
    "enchev-entity", "BG", "auction-operator", "2026-11-01T12:00:00.000Z",
  ), "PLATFORM_ROLE_AMBIGUOUS_APPROVAL");
  fails(() => domain.findApprovedPlatformLegalRole(
    [base, base], "enchev-entity", "BG", "auction-operator", "2026-11-01T12:00:00.000Z",
  ), "PLATFORM_ROLE_DUPLICATE_ID");
  console.log("ENCHEV_ETAP2_SYSTEM_63_01 PASS canonical_role=1 positive_and_negative_checks=16");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
