import fs from "node:fs";
import {
  REQUEST_CORRELATION_HEADER,
  isRequestCorrelationId,
  resolveRequestCorrelationId,
} from "../packages/contracts/src/http-schema.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-request-correlation-id.json", "utf8"));
const openapi = JSON.parse(fs.readFileSync("packages/contracts/openapi/enchev-api.v1.json", "utf8"));

function fail(message) {
  throw new Error("24.05 REQUEST_CORRELATION_ID FAIL: " + message);
}

function requireTrue(condition, message) {
  if (!condition) fail(message);
}

function verifyRepositoryContract() {
  requireTrue(config.taskId === "24.05", "taskId drift");
  requireTrue(config.status === "GREEN", "verified 24.05 evidence status must remain GREEN");
  requireTrue(config.header === "X-Request-ID", "canonical display header drift");
  requireTrue(config.canonicalLowercaseHeader === REQUEST_CORRELATION_HEADER, "runtime header constant drift");
  requireTrue(config.maxLength === 128, "max length drift");

  const proxy = fs.readFileSync("proxy.ts", "utf8");
  requireTrue(proxy.includes('matcher: ["/api/:path*"]'), "API-wide proxy matcher missing");
  requireTrue(proxy.includes("resolveRequestCorrelationId"), "proxy resolver wiring missing");
  requireTrue(proxy.includes("requestHeaders.set(REQUEST_CORRELATION_HEADER, correlationId)"), "downstream request propagation missing");
  requireTrue(proxy.includes("response.headers.set(REQUEST_CORRELATION_HEADER, correlationId)"), "response propagation missing");

  const header = openapi.components?.headers?.RequestCorrelationId;
  requireTrue(header?.schema?.type === "string", "OpenAPI header schema missing");
  requireTrue(header?.schema?.minLength === 1, "OpenAPI header minLength drift");
  requireTrue(header?.schema?.maxLength === 128, "OpenAPI header maxLength drift");
  requireTrue(header?.schema?.pattern === config.acceptedPattern, "OpenAPI header pattern drift");

  const reusableResponses = Object.values(openapi.components?.responses ?? {});
  requireTrue(reusableResponses.length > 0, "reusable response set unexpectedly empty");
  for (const response of reusableResponses) {
    requireTrue(
      response?.headers?.["X-Request-ID"]?.$ref === "#/components/headers/RequestCorrelationId",
      "reusable response missing X-Request-ID"
    );
  }

  for (const [path, pathItem] of Object.entries(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!operation || typeof operation !== "object" || !operation.responses) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (response?.$ref) continue;
        requireTrue(
          response?.headers?.["X-Request-ID"]?.$ref === "#/components/headers/RequestCorrelationId",
          `${method.toUpperCase()} ${path} ${status} missing X-Request-ID`
        );
      }
    }
  }
}

function verifyPositiveBehavior() {
  const inbound = "client.req-123:abc";
  requireTrue(isRequestCorrelationId(inbound), "valid inbound rejected");
  requireTrue(
    resolveRequestCorrelationId(inbound, () => "unused-generator") === inbound,
    "valid inbound must be preserved"
  );

  const generated = resolveRequestCorrelationId(null, () => "00000000-0000-4000-8000-000000000001");
  requireTrue(generated === "00000000-0000-4000-8000-000000000001", "missing inbound generation drift");

  const replacement = resolveRequestCorrelationId("bad value\n", () => "00000000-0000-4000-8000-000000000002");
  requireTrue(replacement === "00000000-0000-4000-8000-000000000002", "invalid inbound must be replaced");
}

function verifyNegativeBehavior() {
  const invalid = [
    "",
    " contains-space",
    "contains space",
    "line\nbreak",
    "slash/value",
    "x".repeat(129),
    "-leading-dash",
  ];
  for (const value of invalid) {
    requireTrue(!isRequestCorrelationId(value), "invalid ID accepted: " + JSON.stringify(value));
  }

  let threw = false;
  try {
    resolveRequestCorrelationId(null, () => "invalid generated value");
  } catch (error) {
    threw = String(error).includes("REQUEST_CORRELATION_ID_GENERATOR_INVALID");
  }
  requireTrue(threw, "invalid generator output must fail closed");
}

verifyRepositoryContract();
verifyPositiveBehavior();

if (process.argv.includes("--self-test")) {
  verifyNegativeBehavior();
  console.log("24.05 REQUEST_CORRELATION_ID_SELF_TEST PASS negative_cases=8");
} else {
  console.log("24.05 REQUEST_CORRELATION_ID PASS api_scope=/api/* header=X-Request-ID");
}
