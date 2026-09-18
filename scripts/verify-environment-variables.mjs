import fs from "node:fs";

const CONFIG_PATH = "config/enchev-environment-variables.json";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function fail(message) {
  throw new Error(`ENV_VAR_VALIDATION FAIL: ${message}`);
}

export function validateConfig(config) {
  if (!config || typeof config !== "object") fail("config must be an object");
  if (config.task !== "01.08") fail("task must be 01.08");
  if (config.name !== "Environment variable validation") fail("name drift");
  if (config.secret_values_in_repository !== false) fail("secret_values_in_repository must remain false");

  const expectedTargets = ["local", "ci", "staging", "production"];
  if (JSON.stringify(config.validation_targets) !== JSON.stringify(expectedTargets)) fail("validation_targets drift");
  if (!Array.isArray(config.variables) || config.variables.length === 0) fail("variables must be non-empty");

  const byName = new Map();
  for (const descriptor of config.variables) {
    if (!descriptor || typeof descriptor !== "object") fail("variable descriptor must be an object");
    if (!/^[A-Z][A-Z0-9_]*$/.test(descriptor.name || "")) fail(`invalid variable name: ${descriptor.name}`);
    if (byName.has(descriptor.name)) fail(`duplicate variable descriptor: ${descriptor.name}`);
    if (!["url", "string"].includes(descriptor.kind)) fail(`unsupported kind for ${descriptor.name}`);
    if (descriptor.required !== false) fail(`${descriptor.name} must remain optional until its owning dependency is GREEN`);
    if (typeof descriptor.secret !== "boolean") fail(`${descriptor.name} secret flag must be explicit`);
    for (const forbiddenField of ["value", "default", "example", "example_value", "credential"]) {
      if (Object.prototype.hasOwnProperty.call(descriptor, forbiddenField)) fail(`${descriptor.name} must not store ${forbiddenField}`);
    }
    if (descriptor.name.startsWith("NEXT_PUBLIC_") && descriptor.secret) fail(`${descriptor.name} cannot expose a secret through NEXT_PUBLIC_`);
    byName.set(descriptor.name, descriptor);
  }

  const fragments = config.forbidden_public_name_fragments || [];
  for (const descriptor of config.variables) {
    if (descriptor.name.startsWith("NEXT_PUBLIC_") && fragments.some((f) => descriptor.name.includes(f))) {
      fail(`public variable name is secret-like: ${descriptor.name}`);
    }
  }

  if (!Array.isArray(config.all_or_none_groups)) fail("all_or_none_groups must be an array");
  const groupNames = new Set();
  for (const group of config.all_or_none_groups) {
    if (!group?.name || groupNames.has(group.name)) fail("all_or_none group names must be unique and non-empty");
    groupNames.add(group.name);
    if (!Array.isArray(group.variables) || group.variables.length < 2) fail(`${group.name} must contain at least two variables`);
    for (const name of group.variables) if (!byName.has(name)) fail(`${group.name} references unknown variable ${name}`);
  }

  if (!Array.isArray(config.platform_managed_variables)) fail("platform_managed_variables must be an array");
  for (const name of config.platform_managed_variables) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) fail(`invalid platform-managed variable name: ${name}`);
  }

  return { byName, groups: config.all_or_none_groups };
}

function validateUrl(name, raw, descriptor) {
  let url;
  try { url = new URL(raw); } catch { fail(`${name} is not a valid URL`); }
  if (!url.hostname) fail(`${name} hostname is missing`);
  const allowed = descriptor.allowed_schemes || [];
  if (allowed.length && !allowed.includes(url.protocol)) fail(`${name} scheme must be one of ${allowed.join(", ")}`);
  if (descriptor.nonlocal_tls_required && !LOCAL_HOSTS.has(url.hostname) && url.protocol !== "rediss:") {
    fail(`${name} non-local endpoint must use rediss:`);
  }
}

export function validateRuntimeEnv(config, env) {
  const { byName, groups } = validateConfig(config);
  const present = [];

  for (const group of groups) {
    const active = group.variables.filter((name) => String(env[name] || "").trim() !== "");
    if (active.length > 0 && active.length !== group.variables.length) {
      fail(`${group.name} binding is incomplete; expected ${group.variables.join(" + ")}`);
    }
  }

  for (const [name, descriptor] of byName) {
    const raw = String(env[name] || "").trim();
    if (!raw) continue;
    present.push(name);
    if (descriptor.kind === "url") validateUrl(name, raw, descriptor);
  }
  return present.sort();
}

export function validateRepositoryIntegration(workflow) {
  for (const marker of [
    "Environment variable contract invariant",
    "Environment variable contract self-tests",
    "Environment variable runtime probe",
    "node scripts/verify-environment-variables.mjs",
    "node scripts/verify-environment-variables.mjs --self-test",
    "node scripts/verify-environment-variables.mjs --runtime"
  ]) if (!workflow.includes(marker)) fail(`CI integration missing: ${marker}`);
}

function expectRejected(label, fn) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

function runSelfTest(config, workflow) {
  validateConfig(config);
  validateRepositoryIntegration(workflow);
  validateRuntimeEnv(config, {});
  validateRuntimeEnv(config, { REDIS_URL: "redis://localhost:6379" });
  validateRuntimeEnv(config, { REDIS_URL: "rediss://cache.example.test:6380" });
  validateRuntimeEnv(config, { UPSTASH_REDIS_REST_URL: "https://redis.example.test", UPSTASH_REDIS_REST_TOKEN: "x" });
  validateRuntimeEnv(config, { KV_REST_API_URL: "https://kv.example.test", KV_REST_API_TOKEN: "x" });

  expectRejected("remote Redis without TLS", () => validateRuntimeEnv(config, { REDIS_URL: "redis://cache.example.test:6379" }));
  expectRejected("invalid Redis URL", () => validateRuntimeEnv(config, { REDIS_URL: "not-a-url" }));
  expectRejected("partial Upstash pair", () => validateRuntimeEnv(config, { UPSTASH_REDIS_REST_URL: "https://redis.example.test" }));
  expectRejected("partial KV pair", () => validateRuntimeEnv(config, { KV_REST_API_TOKEN: "x" }));
  expectRejected("REST URL without HTTPS", () => validateRuntimeEnv(config, { UPSTASH_REDIS_REST_URL: "http://redis.example.test", UPSTASH_REDIS_REST_TOKEN: "x" }));
  expectRejected("duplicate descriptor", () => validateConfig({ ...config, variables: [...config.variables, config.variables[0]] }));
  expectRejected("embedded value", () => validateConfig({ ...config, variables: config.variables.map((v, i) => i === 0 ? { ...v, value: "x" } : v) }));
  expectRejected("public secret descriptor", () => validateConfig({ ...config, variables: [...config.variables, { name: "NEXT_PUBLIC_API_TOKEN", kind: "string", required: false, secret: true }] }));

  console.log("ENV_VAR_VALIDATION_SELF_TEST PASS positive_cases=5 negative_cases=8");
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
validateConfig(config);
validateRepositoryIntegration(workflow);

if (process.argv.includes("--self-test")) {
  runSelfTest(config, workflow);
} else if (process.argv.includes("--runtime")) {
  const present = validateRuntimeEnv(config, process.env);
  console.log(`ENV_VAR_RUNTIME PASS present_known_keys=${present.length} keys=${present.join(",") || "none"} values_exposed=false`);
} else {
  console.log(`ENV_VAR_VALIDATION PASS task=${config.task} descriptors=${config.variables.length} groups=${config.all_or_none_groups.length}`);
}
