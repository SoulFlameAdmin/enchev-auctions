import fs from "node:fs";
import {
  createApiErrorEnvelope,
  isApiErrorEnvelope,
} from "../packages/contracts/src/http-schema.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-standard-error-envelope.json", "utf8"));
const openapi = JSON.parse(fs.readFileSync("packages/contracts/openapi/enchev-api.v1.json", "utf8"));

function fail(message) {
  throw new Error("24.04 STANDARD_ERROR_ENVELOPE FAIL: " + message);
}

function requireTrue(condition, message) {
  if (!condition) fail(message);
}

function verifyFilesAndWiring() {
  requireTrue(config.taskId === "24.04", "taskId drift");
  requireTrue(config.status === "YELLOW", "implementation branch must remain YELLOW until acceptance evidence exists");
  requireTrue(config.closedObjects === true, "error objects must be closed");
  requireTrue(config.factoryRequired === true, "factory must remain required");
  requireTrue(config.runtimeValidationRequired === true, "runtime validation must remain required");
  requireTrue(config.correlationIdDeferredToTask === "24.05", "24.05 correlation-ID boundary drift");

  const schema = openapi.components?.schemas?.ErrorEnvelope;
  requireTrue(schema?.type === "object", "ErrorEnvelope must be an object");
  requireTrue(schema?.additionalProperties === false, "top-level ErrorEnvelope must be closed");
  requireTrue(Array.isArray(schema?.required) && schema.required.length === 1 && schema.required[0] === "error", "top-level required keys drift");

  const nested = schema?.properties?.error;
  requireTrue(nested?.type === "object", "error must be an object");
  requireTrue(nested?.additionalProperties === false, "nested error object must be closed");
  requireTrue(Array.isArray(nested?.required) && nested.required.includes("code") && nested.required.includes("message"), "nested code/message requirements drift");
  requireTrue(nested?.properties?.code?.type === "string" && nested.properties.code.minLength === 1, "error.code contract drift");
  requireTrue(nested?.properties?.message?.type === "string" && nested.properties.message.minLength === 1, "error.message contract drift");

  const runtime = fs.readFileSync("packages/contracts/src/http-schema.ts", "utf8");
  const live = fs.readFileSync("app/api/live-auction-clock/route.ts", "utf8");
  const previousVerifier = fs.readFileSync("scripts/verify-request-response-schema-validation.mjs", "utf8");

  requireTrue(runtime.includes("export function createApiErrorEnvelope"), "runtime factory missing");
  requireTrue(runtime.includes("export function isApiErrorEnvelope"), "runtime validator missing");
  requireTrue(live.includes("createApiErrorEnvelope") && live.includes("assertContractResponse"), "live route standard error wiring missing");
  requireTrue(live.includes('"invalid-json", "Request body must be valid JSON."'), "invalid-json standard error mapping missing");
  requireTrue(live.includes('"unsupported-action", "Only the bid action is supported."'), "unsupported-action standard error mapping missing");
  requireTrue(previousVerifier.includes("isApiErrorEnvelope"), "24.03 regression coverage lost");
}

function verifyPositiveBehavior() {
  const envelope = createApiErrorEnvelope("invalid-json", "Request body must be valid JSON.");
  requireTrue(isApiErrorEnvelope(envelope), "factory output rejected");
  requireTrue(envelope.error.code === "invalid-json", "factory code drift");
  requireTrue(envelope.error.message === "Request body must be valid JSON.", "factory message drift");
}

function verifyNegativeBehavior() {
  const invalid = [
    null,
    {},
    { error: "invalid-json" },
    { error: {} },
    { error: { code: "x" } },
    { error: { message: "x" } },
    { error: { code: "", message: "x" } },
    { error: { code: "x", message: "" } },
    { error: { code: "x", message: "x", detail: "unexpected" } },
    { error: { code: "x", message: "x" }, detail: "unexpected" },
  ];

  for (const value of invalid) {
    requireTrue(!isApiErrorEnvelope(value), "invalid envelope accepted: " + JSON.stringify(value));
  }

  let threw = false;
  try {
    createApiErrorEnvelope("", "x");
  } catch {
    threw = true;
  }
  requireTrue(threw, "factory must reject empty code");
}

verifyFilesAndWiring();
verifyPositiveBehavior();

if (process.argv.includes("--self-test")) {
  verifyNegativeBehavior();
  console.log("24.04 STANDARD_ERROR_ENVELOPE_SELF_TEST PASS negative_cases=11");
} else {
  console.log("24.04 STANDARD_ERROR_ENVELOPE PASS shape=error.code+error.message");
}
