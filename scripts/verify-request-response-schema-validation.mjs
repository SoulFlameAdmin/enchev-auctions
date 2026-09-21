import fs from "node:fs";
import {
  isApiErrorEnvelope,
  isComponentHealthResponse,
  isLiveAuctionDemoClockResponse,
  isRedisEnvironmentHealthResponse,
  isRedisHealthResponse,
  parseLiveAuctionActionRequest,
} from "../packages/contracts/src/http-schema.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-request-response-schema-validation.json", "utf8"));
const openapi = JSON.parse(fs.readFileSync("packages/contracts/openapi/enchev-api.v1.json", "utf8"));

function fail(message) {
  throw new Error("24.03 REQUEST_RESPONSE_SCHEMA_VALIDATION FAIL: " + message);
}

function requireTrue(condition, message) {
  if (!condition) fail(message);
}

function verifyContractFiles() {
  requireTrue(config.taskId === "24.03", "taskId drift");
  requireTrue(config.status === "GREEN", "verified 24.03 evidence status must remain GREEN");
  requireTrue(config.canonicalSpec === "packages/contracts/openapi/enchev-api.v1.json", "canonicalSpec drift");
  requireTrue(config.runtimeContractModule === "packages/contracts/src/http-schema.ts", "runtimeContractModule drift");
  requireTrue(config.failClosed === true, "validation must fail closed");

  for (const value of Object.values(config.coverage || {})) {
    requireTrue(value === true, "declared schema coverage must be enabled");
  }

  const post = openapi.paths?.["/api/live-auction-clock"]?.post;
  const requestSchema = post?.requestBody?.content?.["application/json"]?.schema;
  requireTrue(requestSchema?.type === "object", "live request must be object");
  requireTrue(requestSchema?.additionalProperties === false, "live request must reject additional properties");
  requireTrue(requestSchema?.properties?.action?.const === "bid", "live request action contract drift");
  requireTrue(Array.isArray(requestSchema?.required) && requestSchema.required.includes("action"), "live request action must be required");

  const schemas = openapi.components?.schemas || {};
  for (const name of ["ComponentHealth", "RedisHealth", "RedisEnvironmentHealth", "LiveAuctionDemoClock", "ErrorEnvelope"]) {
    requireTrue(Boolean(schemas[name]), "missing OpenAPI schema " + name);
  }
  requireTrue(schemas.ComponentHealth.additionalProperties === false, "ComponentHealth must be closed");
  requireTrue(schemas.RedisEnvironmentHealth.additionalProperties === false, "RedisEnvironmentHealth must be closed");
  requireTrue(schemas.LiveAuctionDemoClock.additionalProperties === false, "LiveAuctionDemoClock must be closed");
  requireTrue(schemas.ErrorEnvelope.additionalProperties === false, "ErrorEnvelope must be closed");
  requireTrue(schemas.ErrorEnvelope.properties?.error?.additionalProperties === false, "ErrorEnvelope.error must be closed");
  requireTrue(Array.isArray(schemas.ErrorEnvelope.properties?.error?.required) && schemas.ErrorEnvelope.properties.error.required.includes("code") && schemas.ErrorEnvelope.properties.error.required.includes("message"), "ErrorEnvelope code/message contract drift");

  const shared = fs.readFileSync("app/api/health/_shared.ts", "utf8");
  const redis = fs.readFileSync("app/api/health/redis/route.ts", "utf8");
  const redisEnv = fs.readFileSync("app/api/health/redis-env/route.ts", "utf8");
  const live = fs.readFileSync("app/api/live-auction-clock/route.ts", "utf8");
  const index = fs.readFileSync("packages/contracts/src/index.ts", "utf8");

  requireTrue(index.includes('export * from "./http-schema";'), "contracts export missing");
  requireTrue(shared.includes("isComponentHealthResponse") && shared.includes("assertContractResponse"), "component health runtime wiring missing");
  requireTrue(redis.includes("isRedisHealthResponse") && redis.includes("assertContractResponse"), "Redis runtime wiring missing");
  requireTrue(redisEnv.includes("isRedisEnvironmentHealthResponse") && redisEnv.includes("assertContractResponse"), "Redis environment runtime wiring missing");
  requireTrue(live.includes("parseLiveAuctionActionRequest"), "live request validator wiring missing");
  requireTrue(live.includes("isLiveAuctionDemoClockResponse") && live.includes("isApiErrorEnvelope"), "live response validator wiring missing");
}

function verifyPositiveBehavior() {
  requireTrue(JSON.stringify(parseLiveAuctionActionRequest({ action: "bid" })) === '{"action":"bid"}', "valid live request rejected");

  requireTrue(isComponentHealthResponse({
    ok: true, component: "web", ready: true, status: "healthy", schemaVersion: 1, valuesExposed: false
  }), "valid ComponentHealth rejected");

  requireTrue(isRedisHealthResponse({
    ok: true, configured: true, status: "pong", binding: "tcp-url", tls: true, latencyMs: 0
  }), "valid RedisHealth rejected");

  requireTrue(isRedisEnvironmentHealthResponse({
    ok: true, candidateKeyCount: 1, candidateKeys: ["REDIS_URL"], valuesExposed: false
  }), "valid RedisEnvironmentHealth rejected");

  requireTrue(isLiveAuctionDemoClockResponse({
    serverNow: 1, roundEndsAt: 2, durationMs: 1, lotIndex: 0, lotId: "EA-1",
    scope: "server-issued-browser-session-demo", auctionAuthority: false, bidFeedback: null, priceDelta: 0
  }), "valid LiveAuctionDemoClock rejected");

  requireTrue(isApiErrorEnvelope({ error: { code: "invalid-json", message: "Request body must be valid JSON." } }), "valid ErrorEnvelope rejected");
}

function verifyNegativeBehavior() {
  const rejectedRequests = [
    null,
    [],
    {},
    { action: "other" },
    { action: "bid", extra: true },
  ];
  for (const value of rejectedRequests) {
    requireTrue(parseLiveAuctionActionRequest(value) === null, "invalid live request accepted");
  }

  requireTrue(!isComponentHealthResponse({
    ok: true, component: "web", ready: false, status: "healthy", schemaVersion: 1, valuesExposed: false
  }), "inconsistent ComponentHealth accepted");

  requireTrue(!isComponentHealthResponse({
    ok: true, component: "web", ready: true, status: "healthy", schemaVersion: 1, valuesExposed: false, secret: "x"
  }), "ComponentHealth additional property accepted");

  requireTrue(!isRedisHealthResponse({
    ok: true, configured: true, status: "pong", latencyMs: -1
  }), "negative Redis latency accepted");

  requireTrue(!isRedisEnvironmentHealthResponse({
    ok: true, candidateKeyCount: 2, candidateKeys: ["REDIS_URL"], valuesExposed: false
  }), "Redis environment count mismatch accepted");

  requireTrue(!isLiveAuctionDemoClockResponse({
    serverNow: 1, roundEndsAt: 2, durationMs: 1, lotIndex: 0, lotId: "EA-1",
    scope: "server-issued-browser-session-demo", auctionAuthority: true, bidFeedback: null, priceDelta: 0
  }), "authoritative demo response accepted");

  requireTrue(!isApiErrorEnvelope({ error: { code: "x", message: "x" }, detail: "unexpected" }), "ErrorEnvelope additional property accepted");
  requireTrue(!isApiErrorEnvelope({ error: { code: "x", message: "x", detail: "unexpected" } }), "nested ErrorEnvelope additional property accepted");
}

verifyContractFiles();
verifyPositiveBehavior();

if (process.argv.includes("--self-test")) {
  verifyNegativeBehavior();
  console.log("24.03 REQUEST_RESPONSE_SCHEMA_VALIDATION_SELF_TEST PASS negative_cases=12");
} else {
  console.log("24.03 REQUEST_RESPONSE_SCHEMA_VALIDATION PASS coverage=6");
}
