#!/usr/bin/env node
// MISSION-003: no credentials, DB writes, HTTP requests or runtime role grants.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";

const req = createRequire(import.meta.url);
const rolesFile = "packages/domain/src/closed-demo-roles.ts";
const boundaryFile = "packages/domain/src/closed-demo-isolation.ts";
const index = fs.readFileSync("packages/domain/src/index.ts", "utf8");
const overlay = fs.readFileSync("docs/URGENT_DAVID_AGI_ENCHEV_CLOSED_DEMO_V1.md", "utf8");
const source = fs.readFileSync(rolesFile, "utf8");

function must(ok, description) {
  if (!ok) throw new Error("ENCHEV_MISSION003_ROLES FAIL: " + description);
}
must(overlay.includes("### MISSION-003 — Demo identity model"), "canonical mission missing");
must(index.includes('export * from "./closed-demo-roles";'), "package export missing");
must(source.includes("requireIssuedClosedDemoBoundary"), "must require issued isolated boundary");
must(!/\b(fetch|axios|supabase|stripe|paymentIntents)\s*\(/i.test(source), "policy must remain effect-free");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-mission003-"));
try {
  const tsc = path.resolve("node_modules/typescript/bin/tsc");
  must(fs.existsSync(tsc), "TypeScript compiler missing");
  const comp = spawnSync(process.execPath, [
    tsc, rolesFile, boundaryFile, "--ignoreConfig", "--target", "ES2022",
    "--module", "NodeNext", "--moduleResolution", "NodeNext",
    "--skipLibCheck", "--strict", "--outDir", tmp, "--pretty", "false"
  ], {encoding: "utf8"});
  must(comp.status === 0, "TS compilation: " + (comp.stdout || comp.stderr || "").slice(0, 2500));
  const iso = req(path.join(tmp, "closed-demo-isolation.js"));
  const roles = req(path.join(tmp, "closed-demo-roles.js"));

  const env = {
    nodeEnv: "test", vercelEnv: undefined, vercelProjectId: undefined,
    demoProjectId: undefined, enabled: "true",
    namespace: "enchev_closed_demo_local_mission003",
    paymentMode: "simulated-only", documentMode: "watermarked-nonlegal",
    storageMode: "memory-only", paymentProvider: undefined,
    realPaymentsEnabled: undefined, providerSecretPresent: false,
    databaseWriteCredentialPresent: false
  };
  const boundary = iso.createClosedDemoBoundary(env);
  const ids = [
    {role: "seller", subjectId: "demo-seller-001", sessionId: "seller_session_1234567890"},
    {role: "admin", subjectId: "demo-admin-001", sessionId: "admin_session_1234567890"},
    {role: "mitko", subjectId: "demo-mitko-001", sessionId: "mitko_session_1234567890"},
    {role: "borko", subjectId: "demo-borko-001", sessionId: "borko_session_1234567890"},
    {role: "automation", subjectId: "demo-automation-001", sessionId: "automation_session_1234567890"}
  ];
  const roster = roles.createClosedDemoRoleRoster(boundary, ids);
  const a = Object.fromEntries(ids.map(i => [i.role, i]));
  const ns = boundary.namespace;
  const vehicle = {namespace: ns, kind: "vehicle", id: "demo-vehicle-001", sellerId: a.seller.subjectId};
  const lot = {namespace: ns, kind: "lot", id: "demo-lot-001", sellerId: a.seller.subjectId};
  const auction = {namespace: ns, kind: "auction", id: "demo-auction-001", sellerId: a.seller.subjectId};
  const document = {namespace: ns, kind: "document", id: "demo-document-001", sellerId: a.seller.subjectId, demoWatermarked: true};
  const audit = {namespace: ns, kind: "audit", id: "demo-audit-001"};
  const bidFor = role => ({...auction, buyerId: a[role].subjectId});
  const docFor = role => ({...document, buyerId: a[role].subjectId});

  let positives = 0, negatives = 0;
  function allow(role, action, target) {
    const actor = a[role];
    const d = roles.evaluateClosedDemoRolePolicy(roster, actor.subjectId, actor.sessionId, action, target);
    must(d.permitted === true && d.reason === "ALLOW", "expected ALLOW " + role + "/" + action + ": " + d.reason);
    positives++;
  }
  function deny(name, role, action, target, identity = {}) {
    const actor = a[role];
    const d = roles.evaluateClosedDemoRolePolicy(roster,
      identity.subjectId ?? actor.subjectId,
      identity.sessionId ?? actor.sessionId, action, target);
    must(d.permitted === false && d.reason !== "ALLOW", "unsafe grant: " + name);
    negatives++;
  }
  function reject(name, fn) {
    let rejected = false;
    try { fn(); } catch { rejected = true; }
    must(rejected, "unsafe roster creation: " + name);
    negatives++;
  }

  allow("seller", "vehicle:intake", vehicle);
  allow("seller", "vehicle:submit", vehicle);
  allow("admin", "vehicle:approve", vehicle);
  allow("admin", "lot:create", lot);
  allow("admin", "auction:start", auction);
  allow("mitko", "bid:place", bidFor("mitko"));
  allow("borko", "bid:place", bidFor("borko"));
  allow("mitko", "terms:accept", bidFor("mitko"));
  allow("borko", "auction:read", auction);
  allow("seller", "document:preview", document);
  allow("mitko", "document:preview", docFor("mitko"));
  allow("admin", "document:preview", document);
  allow("admin", "audit:read", audit);
  allow("automation", "audit:read", audit);

  reject("forged environment", () => roles.createClosedDemoRoleRoster({...boundary}, ids));
  reject("missing identity", () => roles.createClosedDemoRoleRoster(boundary, ids.slice(0, 4)));
  reject("duplicate role", () => roles.createClosedDemoRoleRoster(boundary, [...ids.slice(0, 4), {...ids[4], role:"seller"}]));
  reject("duplicate subject", () => roles.createClosedDemoRoleRoster(boundary, [...ids.slice(0, 4), {...ids[4], subjectId:ids[0].subjectId}]));
  reject("duplicate session", () => roles.createClosedDemoRoleRoster(boundary, [...ids.slice(0, 4), {...ids[4], sessionId:ids[0].sessionId}]));
  reject("malformed principal ID", () => roles.createClosedDemoRoleRoster(boundary, [{...ids[0], subjectId:"real-user"}, ...ids.slice(1)]));
  reject("short session", () => roles.createClosedDemoRoleRoster(boundary, [{...ids[0], sessionId:"123"}, ...ids.slice(1)]));

  deny("admin cannot bid", "admin", "bid:place", bidFor("mitko"));
  deny("seller cannot bid", "seller", "bid:place", bidFor("mitko"));
  deny("automation cannot bid", "automation", "bid:place", bidFor("mitko"));
  deny("automation cannot settle real money", "automation", "payment:simulate", auction);
  deny("buyer cannot approve vehicle", "mitko", "vehicle:approve", vehicle);
  deny("buyer cannot start auction", "borko", "auction:start", auction);
  deny("cross buyer bid", "mitko", "bid:place", bidFor("borko"));
  deny("cross buyer terms", "borko", "terms:accept", bidFor("mitko"));
  deny("buyer lacks owner", "mitko", "bid:place", auction);
  deny("buyer cannot view other document", "mitko", "document:preview", docFor("borko"));
  deny("seller cannot view other seller", "seller", "document:preview", {...document,sellerId:"demo-stranger-001"});
  deny("document requires watermark", "admin", "document:preview", {...document,demoWatermarked:false});
  deny("wrong namespace", "admin", "audit:read", {...audit,namespace:"public"});
  deny("wrong target kind", "admin", "lot:create", vehicle);
  deny("wrong session", "mitko", "bid:place", bidFor("mitko"), {sessionId:"borko_session_1234567890"});
  deny("unknown subject", "mitko", "bid:place", bidFor("mitko"), {subjectId:"demo-stranger-001"});
  deny("unsupported release action", "admin", "release:authorize", document);

  const forged = roles.evaluateClosedDemoRolePolicy({...roster}, a.admin.subjectId, a.admin.sessionId, "audit:read", audit);
  must(!forged.permitted && forged.reason==="UNVERIFIED_ROSTER", "forged roster accepted");
  negatives++;
  must(Object.isFrozen(roster) && Object.isFrozen(roster.identities) &&
       roster.identities.every(Object.isFrozen), "mutable roster");
  must(roster.identities.length === 5 && new Set(roster.identities.map(i => i.subjectId)).size === 5,
       "identity isolation");
  console.log("ENCHEV_MISSION003_ROLES PASS positives=" + positives +
    " negatives=" + negatives + " with no DB/auth/production side effects; status remains YELLOW");
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}
