import fs from "node:fs";
import {
  RATE_LIMIT_STATUS,
  createRateLimitResponseContract,
  isRateLimitResponseContract,
} from "../packages/contracts/src/http-schema.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-rate-limit-response-contract.json", "utf8"));

function fail(message) { throw new Error("24.08 RATE_LIMIT_RESPONSE FAIL: " + message); }
function requireTrue(condition, message) { if (!condition) fail(message); }
function requireThrows(fn, code) {
  let actual = "";
  try { fn(); } catch (error) { actual = String(error); }
  requireTrue(actual.includes(code), "expected " + code + " but got " + actual);
}

requireTrue(config.taskId === "24.08", "taskId drift");
requireTrue(config.status === RATE_LIMIT_STATUS, "status drift");

const response = createRateLimitResponseContract({
  retryAfterSeconds: 7,
  limit: 100,
  remaining: 0,
  resetEpochSeconds: 1790009000,
});
requireTrue(response.status === 429, "status must be 429");
requireTrue(response.error.error.code === "RATE_LIMITED", "error envelope code drift");
requireTrue(response.headers["retry-after"] === "7", "Retry-After drift");
requireTrue(response.headers["x-ratelimit-limit"] === "100", "limit header drift");
requireTrue(response.headers["x-ratelimit-remaining"] === "0", "remaining header drift");
requireTrue(response.headers["x-ratelimit-reset"] === "1790009000", "reset header drift");
requireTrue(isRateLimitResponseContract(response), "valid contract rejected");

if (process.argv.includes("--self-test")) {
  requireThrows(() => createRateLimitResponseContract({
    retryAfterSeconds: -1, limit: 100, remaining: 0, resetEpochSeconds: 1,
  }), "RATE_LIMIT_INVALID_RETRY_AFTER");
  requireThrows(() => createRateLimitResponseContract({
    retryAfterSeconds: 1, limit: 0, remaining: 0, resetEpochSeconds: 1,
  }), "RATE_LIMIT_INVALID_LIMIT");
  requireThrows(() => createRateLimitResponseContract({
    retryAfterSeconds: 1, limit: 10, remaining: 11, resetEpochSeconds: 1,
  }), "RATE_LIMIT_INVALID_REMAINING");
  requireThrows(() => createRateLimitResponseContract({
    retryAfterSeconds: 1, limit: 10, remaining: 0, resetEpochSeconds: -1,
  }), "RATE_LIMIT_INVALID_RESET");

  const invalidResponses = [
    { ...response, status: 200 },
    { ...response, headers: { ...response.headers, "retry-after": "-1" } },
    { ...response, headers: { ...response.headers, "x-ratelimit-limit": "0" } },
    { ...response, headers: { ...response.headers, "x-ratelimit-remaining": "101" } },
    { ...response, headers: { ...response.headers, extra: "1" } },
  ];
  for (const candidate of invalidResponses) {
    requireTrue(!isRateLimitResponseContract(candidate), "invalid response accepted");
  }
  console.log("24.08 RATE_LIMIT_RESPONSE_SELF_TEST PASS negative_cases=" + (4 + invalidResponses.length));
} else {
  console.log("24.08 RATE_LIMIT_RESPONSE PASS status=429 retry_after=required metadata=fail-closed");
}
