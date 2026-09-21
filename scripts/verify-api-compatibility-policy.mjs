import fs from "node:fs";

const POLICY = "config/enchev-api-compatibility-policy.json";
const SPEC = "packages/contracts/openapi/enchev-api.v1.json";
const INVENTORY = "config/enchev-api-endpoint-inventory.json";

function fail(message) {
  throw new Error(`API_COMPATIBILITY_POLICY FAIL: ${message}`);
}

function days(a, b) {
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) fail("invalid deprecation date");
  return Math.floor((end - start) / 86400000);
}

export function validate(policy, spec, inventory) {
  if (policy.version !== 1 || policy.task !== "24.10" || policy.compatibilityLine !== "v1") fail("policy identity drift");
  if (policy.openApiPath !== SPEC || policy.endpointInventoryPath !== INVENTORY) fail("policy source path drift");
  if (!String(policy.authorityBoundary || "").includes("PostgreSQL remains authoritative")) fail("authority boundary missing");
  if (!String(policy.breakingChangeRule || "").includes("Breaking changes require a new compatibility line")) fail("breaking-change rule missing");

  const dep = policy.deprecation;
  if (!dep || !Number.isInteger(dep.minimumNoticeDays) || dep.minimumNoticeDays < 1) fail("minimum notice invalid");
  if (dep.requiredFlag !== "deprecated" || dep.metadataExtension !== "x-enchev-deprecation") fail("deprecation contract drift");
  const required = ["announcedOn", "sunsetNotBefore", "replacementOperationId", "reason"];
  if (JSON.stringify(dep.requiredMetadataFields) !== JSON.stringify(required)) fail("deprecation fields drift");

  const protectedMap = new Map();
  const operationIds = new Set();
  for (const item of policy.protectedOperations || []) {
    const key = `${item.method} ${item.path}`;
    if (protectedMap.has(key)) fail(`duplicate protected operation ${key}`);
    protectedMap.set(key, item);
    if (operationIds.has(item.operationId)) fail(`duplicate operationId ${item.operationId}`);
    operationIds.add(item.operationId);

    const op = spec?.paths?.[item.path]?.[String(item.method).toLowerCase()];
    if (!op) fail(`protected operation removed: ${key}`);
    if (op.operationId !== item.operationId) fail(`operationId changed: ${key}`);
    const codes = new Set(Object.keys(op.responses || {}));
    for (const code of item.responseCodes || []) {
      if (!codes.has(String(code))) fail(`response code removed: ${key} ${code}`);
    }
    if (item.requestBodyRequired === false && op.requestBody?.required === true) {
      fail(`optional request body became required: ${key}`);
    }
  }

  const inventoryKeys = new Set();
  for (const item of inventory.endpoints || []) {
    const key = `${item.method} ${item.path}`;
    if (inventoryKeys.has(key)) fail(`duplicate inventory operation ${key}`);
    inventoryKeys.add(key);
    const covered = protectedMap.get(key);
    if (!covered) fail(`inventory operation not protected: ${key}`);
    if (covered.operationId !== item.operationId) fail(`inventory operationId drift: ${key}`);
  }
  for (const key of protectedMap.keys()) {
    if (!inventoryKeys.has(key)) fail(`protected operation missing from inventory: ${key}`);
  }

  let deprecated = 0;
  for (const [path, item] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(item || {})) {
      if (!op || typeof op !== "object") continue;
      const meta = op["x-enchev-deprecation"];
      if (meta && op.deprecated !== true) fail(`deprecation metadata without deprecated=true: ${method.toUpperCase()} ${path}`);
      if (op.deprecated !== true) continue;
      deprecated += 1;
      if (!meta || typeof meta !== "object") fail(`missing deprecation metadata: ${method.toUpperCase()} ${path}`);
      for (const field of required) if (!(field in meta)) fail(`missing deprecation field ${field}`);
      if (days(meta.announcedOn, meta.sunsetNotBefore) < dep.minimumNoticeDays) fail("deprecation notice too short");
      if (!String(meta.reason || "").trim()) fail("deprecation reason missing");
      if (meta.replacementOperationId !== null && !operationIds.has(meta.replacementOperationId)) {
        fail(`replacement operation missing: ${meta.replacementOperationId}`);
      }
    }
  }

  return { protected: protectedMap.size, deprecated, noticeDays: dep.minimumNoticeDays };
}

const policy = JSON.parse(fs.readFileSync(POLICY, "utf8"));
const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
const inventory = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
const result = validate(policy, spec, inventory);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const p = structuredClone(policy);
    const s = structuredClone(spec);
    const i = structuredClone(inventory);
    mutate(p, s, i);
    let rejected = false;
    try { validate(p, s, i); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test accepted: ${label}`);
    cases += 1;
  };

  reject("operation removed", (_p, s) => { delete s.paths["/api/health/web"].get; });
  reject("operationId renamed", (_p, s) => { s.paths["/api/health/api"].get.operationId = "renamed"; });
  reject("response code removed", (_p, s) => { delete s.paths["/api/health/redis"].get.responses["503"]; });
  reject("request tightened", (_p, s) => { s.paths["/api/health/web"].get.requestBody = { required: true }; });
  reject("inventory uncovered", (p) => { p.protectedOperations.pop(); });
  reject("deprecated metadata missing", (_p, s) => { s.paths["/api/health/web"].get.deprecated = true; });
  reject("notice too short", (_p, s) => {
    const op = s.paths["/api/health/web"].get;
    op.deprecated = true;
    op["x-enchev-deprecation"] = { announcedOn: "2026-09-21", sunsetNotBefore: "2026-10-01", replacementOperationId: "getApiHealth", reason: "test" };
  });
  reject("replacement missing", (_p, s) => {
    const op = s.paths["/api/health/web"].get;
    op.deprecated = true;
    op["x-enchev-deprecation"] = { announcedOn: "2026-09-21", sunsetNotBefore: "2026-12-20", replacementOperationId: "missingOperation", reason: "test" };
  });

  console.log(`API_COMPATIBILITY_POLICY_SELF_TEST PASS cases=${cases} protected=${result.protected} notice_days=${result.noticeDays}`);
} else {
  console.log(`API_COMPATIBILITY_POLICY PASS task=24.10 line=v1 protected=${result.protected} deprecated=${result.deprecated} notice_days=${result.noticeDays}`);
}
