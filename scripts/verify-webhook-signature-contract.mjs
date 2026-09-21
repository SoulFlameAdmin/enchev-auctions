import fs from "node:fs";
import {
  ENCHEV_WEBHOOK_MAX_ACTIVE_SECRETS,
  ENCHEV_WEBHOOK_REPLAY_TOLERANCE_SECONDS,
  ENCHEV_WEBHOOK_SECRET_MIN_LENGTH,
  signEnchevWebhook,
  verifyEnchevWebhook,
} from "../packages/contracts/src/webhook-signature.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-webhook-signature-contract.json", "utf8"));
function fail(message) { throw new Error("24.11 WEBHOOK_SIGNATURE FAIL: " + message); }
function requireTrue(condition, message) { if (!condition) fail(message); }
function requireThrows(fn, code) {
  let actual = "";
  try { fn(); } catch (error) { actual = String(error); }
  requireTrue(actual.includes(code), "expected " + code + " but got " + actual);
}

requireTrue(config.task === "24.11", "task drift");
requireTrue(config.algorithm === "HMAC-SHA256", "algorithm drift");
requireTrue(config.signatureVersion === "v1" && config.signaturePrefix === "v1=", "version drift");
requireTrue(config.signedMessage === "<timestamp>.<deliveryId>.<rawBody>", "signed message drift");
requireTrue(config.replayToleranceSeconds === ENCHEV_WEBHOOK_REPLAY_TOLERANCE_SECONDS, "replay window drift");
requireTrue(config.secretMinLength === ENCHEV_WEBHOOK_SECRET_MIN_LENGTH, "secret minimum drift");
requireTrue(config.maxActiveSecrets === ENCHEV_WEBHOOK_MAX_ACTIVE_SECRETS, "rotation limit drift");
requireTrue(config.deliveryIdFormat === "uuid", "delivery id format drift");
requireTrue(String(config.authorityBoundary).includes("PostgreSQL remains authoritative"), "authority boundary missing");

const secret = "current-secret-0123456789-ABCDEFGHIJK";
const previous = "previous-secret-0123456789-ABCDEFGHI";
const deliveryId = "123e4567-e89b-42d3-a456-426614174000";
const now = 1790035200;
const timestamp = String(now);
const rawBody = '{"event":"lot.updated","lotId":"EA-10539"}';
const signature = signEnchevWebhook({ timestamp, deliveryId, rawBody, secret });
requireTrue(/^v1=[0-9a-f]{64}$/.test(signature), "signature encoding drift");

const verified = verifyEnchevWebhook({
  timestamp, deliveryId, rawBody, signature, secrets: [secret, previous], nowSeconds: now,
});
requireTrue(verified.ok && verified.deliveryId === deliveryId, "valid signature rejected");

const previousSignature = signEnchevWebhook({ timestamp, deliveryId, rawBody, secret: previous });
requireTrue(
  verifyEnchevWebhook({ timestamp, deliveryId, rawBody, signature: previousSignature, secrets: [secret, previous], nowSeconds: now }).ok,
  "previous rotation secret rejected",
);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, fn, code) => {
    requireThrows(fn, code);
    cases += 1;
  };
  reject("tampered body", () => verifyEnchevWebhook({
    timestamp, deliveryId, rawBody: rawBody + " ", signature, secrets: [secret], nowSeconds: now,
  }), "WEBHOOK_SIGNATURE_MISMATCH");
  reject("wrong secret", () => verifyEnchevWebhook({
    timestamp, deliveryId, rawBody, signature, secrets: ["wrong-secret-0123456789-ABCDEFGHIJK"], nowSeconds: now,
  }), "WEBHOOK_SIGNATURE_MISMATCH");
  reject("replay old", () => verifyEnchevWebhook({
    timestamp: String(now - 301), deliveryId, rawBody,
    signature: signEnchevWebhook({ timestamp: String(now - 301), deliveryId, rawBody, secret }),
    secrets: [secret], nowSeconds: now,
  }), "WEBHOOK_REPLAY_WINDOW_EXCEEDED");
  reject("replay future", () => verifyEnchevWebhook({
    timestamp: String(now + 301), deliveryId, rawBody,
    signature: signEnchevWebhook({ timestamp: String(now + 301), deliveryId, rawBody, secret }),
    secrets: [secret], nowSeconds: now,
  }), "WEBHOOK_REPLAY_WINDOW_EXCEEDED");
  reject("bad delivery id", () => verifyEnchevWebhook({
    timestamp, deliveryId: "not-a-uuid", rawBody, signature, secrets: [secret], nowSeconds: now,
  }), "WEBHOOK_DELIVERY_ID_INVALID");
  reject("bad signature format", () => verifyEnchevWebhook({
    timestamp, deliveryId, rawBody, signature: "sha256=deadbeef", secrets: [secret], nowSeconds: now,
  }), "WEBHOOK_SIGNATURE_FORMAT_INVALID");
  reject("short secret", () => signEnchevWebhook({ timestamp, deliveryId, rawBody, secret: "short" }), "WEBHOOK_SECRET_INVALID");
  reject("too many active secrets", () => verifyEnchevWebhook({
    timestamp, deliveryId, rawBody, signature, secrets: [secret, previous, secret], nowSeconds: now,
  }), "WEBHOOK_SECRET_SET_INVALID");

  console.log("24.11 WEBHOOK_SIGNATURE_SELF_TEST PASS negative_cases=" + cases + " rotation=current+previous replay_seconds=" + config.replayToleranceSeconds);
} else {
  console.log("24.11 WEBHOOK_SIGNATURE PASS algorithm=HMAC-SHA256 version=v1 replay_seconds=" + config.replayToleranceSeconds + " rotation=max2");
}
