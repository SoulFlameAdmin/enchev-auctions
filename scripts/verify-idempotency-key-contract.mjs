import fs from "node:fs";
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  decideIdempotencyAction,
  isIdempotencyKey,
  requireIdempotencyKey,
} from "../packages/contracts/src/http-schema.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-idempotency-key-contract.json", "utf8"));
function fail(message) { throw new Error("24.07 IDEMPOTENCY_KEY FAIL: " + message); }
function requireTrue(condition, message) { if (!condition) fail(message); }
function requireThrows(fn, code) {
  let actual = "";
  try { fn(); } catch (error) { actual = String(error); }
  requireTrue(actual.includes(code), "expected " + code + " but got " + actual);
}

requireTrue(config.taskId === "24.07", "taskId drift");
requireTrue(IDEMPOTENCY_KEY_HEADER === "idempotency-key", "header drift");
requireTrue(config.maxLength === IDEMPOTENCY_KEY_MAX_LENGTH, "max length drift");
requireTrue(isIdempotencyKey("bid-req_01:abc.def"), "valid key rejected");
requireTrue(requireIdempotencyKey("payment.capture_42") === "payment.capture_42", "valid key not preserved");

const execute = decideIdempotencyAction(null, "fp-1");
requireTrue(execute.action === "execute", "new request must execute");

const replay = decideIdempotencyAction({ requestFingerprint: "fp-1", state: "completed" }, "fp-1");
requireTrue(replay.action === "replay", "completed matching request must replay");

const inProgress = decideIdempotencyAction({ requestFingerprint: "fp-1", state: "in-progress" }, "fp-1");
requireTrue(inProgress.action === "in-progress" && inProgress.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS", "in-progress duplicate drift");

const conflict = decideIdempotencyAction({ requestFingerprint: "fp-1", state: "completed" }, "fp-2");
requireTrue(conflict.action === "conflict" && conflict.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST", "fingerprint conflict drift");

if (process.argv.includes("--self-test")) {
  const invalid = ["", " key", "key ", "bad/key", "bad key", "x".repeat(129)];
  for (const value of invalid) {
    requireTrue(!isIdempotencyKey(value), "invalid key accepted: " + JSON.stringify(value));
    requireThrows(() => requireIdempotencyKey(value), "IDEMPOTENCY_KEY_INVALID");
  }
  requireThrows(() => decideIdempotencyAction(null, ""), "IDEMPOTENCY_FINGERPRINT_REQUIRED");
  console.log("24.07 IDEMPOTENCY_KEY_SELF_TEST PASS negative_cases=" + (invalid.length + 1));
} else {
  console.log("24.07 IDEMPOTENCY_KEY PASS header=Idempotency-Key max_length=128 replay=deterministic conflict=fail-closed");
}
