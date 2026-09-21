import { createHmac, timingSafeEqual } from "node:crypto";

export const ENCHEV_WEBHOOK_SIGNATURE_VERSION = "v1";
export const ENCHEV_WEBHOOK_REPLAY_TOLERANCE_SECONDS = 300;
export const ENCHEV_WEBHOOK_SECRET_MIN_LENGTH = 32;
export const ENCHEV_WEBHOOK_MAX_ACTIVE_SECRETS = 2;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64_RE = /^[0-9a-f]{64}$/i;

function assertSecret(secret: string) {
  if (typeof secret !== "string" || secret.length < ENCHEV_WEBHOOK_SECRET_MIN_LENGTH) {
    throw new Error("WEBHOOK_SECRET_INVALID");
  }
}

function assertDeliveryId(deliveryId: string) {
  if (!UUID_RE.test(deliveryId)) throw new Error("WEBHOOK_DELIVERY_ID_INVALID");
}

function assertTimestamp(timestamp: string) {
  if (!/^\d{10}$/.test(timestamp)) throw new Error("WEBHOOK_TIMESTAMP_INVALID");
}

export function webhookSignedMessage(timestamp: string, deliveryId: string, rawBody: string | Buffer) {
  assertTimestamp(timestamp);
  assertDeliveryId(deliveryId);
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  return Buffer.concat([
    Buffer.from(timestamp + "." + deliveryId + ".", "utf8"),
    body,
  ]);
}

export function signEnchevWebhook(input: {
  timestamp: string;
  deliveryId: string;
  rawBody: string | Buffer;
  secret: string;
}) {
  assertSecret(input.secret);
  const digest = createHmac("sha256", input.secret)
    .update(webhookSignedMessage(input.timestamp, input.deliveryId, input.rawBody))
    .digest("hex");
  return ENCHEV_WEBHOOK_SIGNATURE_VERSION + "=" + digest;
}

export function verifyEnchevWebhook(input: {
  timestamp: string;
  deliveryId: string;
  rawBody: string | Buffer;
  signature: string;
  secrets: string[];
  nowSeconds?: number;
  replayToleranceSeconds?: number;
}) {
  assertTimestamp(input.timestamp);
  assertDeliveryId(input.deliveryId);
  if (!Array.isArray(input.secrets) || input.secrets.length < 1 || input.secrets.length > ENCHEV_WEBHOOK_MAX_ACTIVE_SECRETS) {
    throw new Error("WEBHOOK_SECRET_SET_INVALID");
  }
  for (const secret of input.secrets) assertSecret(secret);

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ts = Number(input.timestamp);
  const tolerance = input.replayToleranceSeconds ?? ENCHEV_WEBHOOK_REPLAY_TOLERANCE_SECONDS;
  if (!Number.isInteger(tolerance) || tolerance < 1) throw new Error("WEBHOOK_REPLAY_TOLERANCE_INVALID");
  if (Math.abs(now - ts) > tolerance) throw new Error("WEBHOOK_REPLAY_WINDOW_EXCEEDED");

  const prefix = ENCHEV_WEBHOOK_SIGNATURE_VERSION + "=";
  if (!input.signature.startsWith(prefix)) throw new Error("WEBHOOK_SIGNATURE_FORMAT_INVALID");
  const providedHex = input.signature.slice(prefix.length);
  if (!HEX_64_RE.test(providedHex)) throw new Error("WEBHOOK_SIGNATURE_FORMAT_INVALID");
  const provided = Buffer.from(providedHex, "hex");

  let matched = false;
  for (const secret of input.secrets) {
    const candidateHex = signEnchevWebhook({
      timestamp: input.timestamp,
      deliveryId: input.deliveryId,
      rawBody: input.rawBody,
      secret,
    }).slice(prefix.length);
    const candidate = Buffer.from(candidateHex, "hex");
    matched = timingSafeEqual(provided, candidate) || matched;
  }
  if (!matched) throw new Error("WEBHOOK_SIGNATURE_MISMATCH");
  return {
    ok: true as const,
    deliveryId: input.deliveryId,
    timestamp: ts,
    signatureVersion: ENCHEV_WEBHOOK_SIGNATURE_VERSION,
  };
}
