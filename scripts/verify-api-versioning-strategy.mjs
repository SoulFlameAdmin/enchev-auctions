import fs from "node:fs";

const STRATEGY_PATH = "config/enchev-api-versioning-strategy.json";
const SPEC_PATH = "packages/contracts/openapi/enchev-api.v1.json";

function fail(message) {
  throw new Error(`API_VERSIONING_STRATEGY FAIL: ${message}`);
}

function parseSemver(value) {
  if (typeof value !== "string") fail("semantic version must be a string");
  const core = value.split(/[+-]/, 1)[0];
  const parts = core.split(".");
  if (parts.length !== 3) fail(`invalid semantic version: ${value}`);
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((number, index) => !Number.isInteger(number) || number < 0 || String(number) !== parts[index])) {
    fail(`invalid semantic version: ${value}`);
  }
  return { major: numbers[0], minor: numbers[1], patch: numbers[2] };
}

function isReservedVersionedMajorPath(value) {
  const segments = String(value).split("/");
  if (segments.length < 3) return false;
  const candidate = segments[2] || "";
  if (!candidate.startsWith("v")) return false;
  const major = candidate.slice(1);
  return major.length > 0 && [...major].every((char) => char >= "0" && char <= "9");
}

export function validate(strategy, spec) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) fail("strategy must be an object");
  if (strategy.taskId !== "24.02") fail("taskId must be 24.02");
  if (strategy.name !== "API versioning strategy") fail("strategy name mismatch");
  if (strategy.currentRoutingMode !== "unversioned-current-contract") fail("current routing mode drift");
  if (strategy.currentBasePath !== "/api") fail("current base path must remain /api");
  if (strategy.futureBreakingVersionPathTemplate !== "/api/v{major}") fail("future major path template drift");

  const current = parseSemver(strategy.currentContractVersion);
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail("OpenAPI spec must be an object");
  if (!spec.info || spec.info.version !== strategy.currentContractVersion) fail("OpenAPI info.version must match currentContractVersion");
  const openApiVersion = parseSemver(spec.info.version);
  if (JSON.stringify(current) !== JSON.stringify(openApiVersion)) fail("semantic version mismatch");

  const rules = strategy.rules || {};
  for (const key of [
    "noSilentBreakingChanges",
    "breakingChangeRequiresNewContractVersion",
    "breakingChangeRequiresCompatibilityPlan",
    "breakingChangeRequiresDeprecationWindow",
    "existingUnversionedRoutesRemainStable",
    "versionSelectionMustBeExplicitForFutureMajorRoutes",
    "authoritySemanticsCannotChangeByVersionNegotiation"
  ]) {
    if (rules[key] !== true) fail(`required rule disabled: ${key}`);
  }

  const compatibility = strategy.compatibility || {};
  if (compatibility.unsupportedVersionBehavior !== "fail-closed") fail("unsupported versions must fail closed");
  const requiredDeprecation = ["replacement-version", "migration-notice", "sunset-gate"];
  if (JSON.stringify(compatibility.deprecationRequires) !== JSON.stringify(requiredDeprecation)) fail("deprecation requirements drift");

  const boundaries = strategy.boundaries || {};
  for (const key of [
    "doesNotCreateNewEndpoints",
    "doesNotChangeAuctionAuthority",
    "doesNotDeprecateCurrentRoutes",
    "doesNotClaimPublicStableV1"
  ]) {
    if (boundaries[key] !== true) fail(`boundary must remain true: ${key}`);
  }

  if (spec["x-enchev-task"] !== "24.01") fail("24.01 OpenAPI ownership must remain intact");
  if (spec["x-api-versioning-strategy-task"] !== "24.02") fail("OpenAPI must reference 24.02 versioning strategy");
  if (spec["x-current-routing-mode"] !== strategy.currentRoutingMode) fail("OpenAPI routing mode marker drift");
  if (typeof spec["x-authority-boundary"] !== "string" || !spec["x-authority-boundary"].includes("PostgreSQL remains authoritative")) {
    fail("auction authority boundary missing");
  }

  const paths = Object.keys(spec.paths || {});
  if (!paths.length) fail("OpenAPI paths missing");
  if (paths.some(isReservedVersionedMajorPath)) fail("versioned routes cannot be invented by strategy task");
  if (paths.some((value) => !value.startsWith("/api/"))) fail("all current paths must remain under /api");

  return {
    version: strategy.currentContractVersion,
    routingMode: strategy.currentRoutingMode,
    paths: paths.length,
    preStable: current.major === 0
  };
}

const strategy = JSON.parse(fs.readFileSync(STRATEGY_PATH, "utf8"));
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
const result = validate(strategy, spec);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  function rejected(label, mutateStrategy = () => {}, mutateSpec = () => {}) {
    const s = structuredClone(strategy);
    const o = structuredClone(spec);
    mutateStrategy(s);
    mutateSpec(o);
    let rejectedCase = false;
    try { validate(s, o); } catch { rejectedCase = true; }
    if (!rejectedCase) fail(`negative self-test was not rejected: ${label}`);
    cases += 1;
  }

  rejected("silent breaking changes enabled", (s) => { s.rules.noSilentBreakingChanges = false; });
  rejected("missing compatibility plan", (s) => { s.rules.breakingChangeRequiresCompatibilityPlan = false; });
  rejected("open unsupported versions", (s) => { s.compatibility.unsupportedVersionBehavior = "fallback-current"; });
  rejected("version mismatch", (s) => { s.currentContractVersion = "0.2.0"; });
  rejected("stable v1 falsely claimed", (s) => { s.boundaries.doesNotClaimPublicStableV1 = false; });
  rejected("invented versioned route", () => {}, (o) => { o.paths["/api/v1/example"] = o.paths["/api/health/web"]; });
  rejected("authority marker removed", () => {}, (o) => { delete o["x-authority-boundary"]; });
  rejected("OpenAPI 24.01 ownership drift", () => {}, (o) => { o["x-enchev-task"] = "24.02"; });

  console.log(`API_VERSIONING_STRATEGY_SELF_TEST PASS cases=${cases} version=${result.version} routing=${result.routingMode} paths=${result.paths}`);
} else {
  console.log(`API_VERSIONING_STRATEGY PASS task=24.02 version=${result.version} routing=${result.routingMode} paths=${result.paths} pre_stable=${result.preStable} fail_closed=true`);
}
