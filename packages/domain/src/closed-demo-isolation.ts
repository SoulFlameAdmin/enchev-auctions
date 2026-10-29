/**
 * MISSION-002: CLOSED DEMO effect boundary.
 * Pure domain preparation only. NO I/O, SDKs, HTTP, secrets, persistence,
 * real money or legal document issuance is implemented here.
 * The trusted server entrypoint must read runtime env directly.
 */
export const CLOSED_DEMO_PRODUCTION_VERCEL_PROJECT_ID =
  "prj_X3TAEQf9oGE79te9NdNlvB6jnhno" as const;

export const CLOSED_DEMO_DOCUMENT_WATERMARK =
  "DEMO — NOT A LEGAL DOCUMENT — NOT A TAX INVOICE" as const;

export type ClosedDemoEnvironment = Readonly<{
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  vercelProjectId: string | undefined;
  demoProjectId: string | undefined;
  enabled: string | undefined;
  namespace: string | undefined;
  paymentMode: string | undefined;
  documentMode: string | undefined;
  storageMode: string | undefined;
  paymentProvider: string | undefined;
  realPaymentsEnabled: string | undefined;
  providerSecretPresent: boolean;
  databaseWriteCredentialPresent: boolean;
}>;

export type ClosedDemoBoundary = Readonly<{
  scope: "ENCHEV_CLOSED_DEMO";
  environment: "local" | "preview";
  namespace: string;
  storageMode: "memory-only";
  paymentMode: "simulated-only";
  documentMode: "watermarked-nonlegal";
  externalEffects: false;
}>;

export type ClosedDemoDocumentKind =
  | "vehicle-intake"
  | "seller-declaration"
  | "auction-close"
  | "purchase-summary"
  | "pro-forma"
  | "payment-confirmation"
  | "vehicle-release"
  | "handover"
  | "completion";

export type ClosedDemoDocument = Readonly<{
  kind: "DEMO_DOCUMENT_PREVIEW";
  documentKind: ClosedDemoDocumentKind;
  transactionId: string;
  namespace: string;
  watermark: typeof CLOSED_DEMO_DOCUMENT_WATERMARK;
  legalEffect: false;
  taxInvoice: false;
  storageMode: "memory-only";
}>;

export type ClosedDemoPayment = Readonly<{
  kind: "DEMO_PAYMENT_PREVIEW";
  transactionId: string;
  namespace: string;
  amountMinor: number;
  currency: "EUR";
  state: "NOT_PAYABLE";
  provider: "NONE";
  canCharge: false;
  canSettle: false;
  hasPayableInstructions: false;
  storageMode: "memory-only";
}>;

const issuedBoundaries = new WeakSet<object>();
const transactionIdPattern = /^demo-[a-z0-9][a-z0-9_-]{2,63}$/;
const namespacePattern = /^enchev_closed_demo_(local|preview)_[a-z0-9]{4,24}$/;

function reject(reason: string): never {
  // Fixed reason codes only; never include environment values or secrets.
  throw new Error("ENCHEV_CLOSED_DEMO_DISABLED:" + reason);
}

/**
 * Only allow local test/development or a separate, explicitly named Vercel
 * Preview project. A production build running in Preview may set
 * NODE_ENV=production, so it is the VERCEL_ENV + exact project combination
 * that matters. An unknown/ambiguous environment fails closed.
 */
export function createClosedDemoBoundary(env: ClosedDemoEnvironment): ClosedDemoBoundary {
  if (!env || typeof env !== "object") reject("INVALID_CONTEXT");
  if (env.enabled !== "true") reject("FEATURE_DISABLED");
  if (env.paymentMode !== "simulated-only"
      || env.documentMode !== "watermarked-nonlegal"
      || env.storageMode !== "memory-only") reject("UNSAFE_EFFECT_MODE");
  if (env.paymentProvider || (env.realPaymentsEnabled !== undefined && env.realPaymentsEnabled !== "" && env.realPaymentsEnabled !== "false")
      || env.providerSecretPresent !== false
      || env.databaseWriteCredentialPresent !== false) reject("REAL_EFFECT_CAPABILITY_PRESENT");

  let environment: "local" | "preview";
  if (env.vercelEnv === undefined || env.vercelEnv === "") {
    if (env.nodeEnv !== "development" && env.nodeEnv !== "test") reject("UNKNOWN_LOCAL_RUNTIME");
    if (env.vercelProjectId || env.demoProjectId) reject("AMBIGUOUS_LOCAL_PROJECT");
    environment = "local";
  } else if (env.vercelEnv === "preview") {
    if (env.nodeEnv !== "production") reject("UNKNOWN_PREVIEW_RUNTIME");
    if (!env.vercelProjectId || !env.demoProjectId ||
        env.vercelProjectId !== env.demoProjectId ||
        env.vercelProjectId === CLOSED_DEMO_PRODUCTION_VERCEL_PROJECT_ID) {
      reject("PREVIEW_PROJECT_NOT_ISOLATED");
    }
    environment = "preview";
  } else {
    reject("PRODUCTION_OR_UNKNOWN_RUNTIME");
  }

  if (!env.namespace || !namespacePattern.test(env.namespace)
      || !env.namespace.startsWith("enchev_closed_demo_" + environment + "_")) {
    reject("UNSAFE_NAMESPACE");
  }

  const boundary: ClosedDemoBoundary = Object.freeze({
    scope: "ENCHEV_CLOSED_DEMO",
    environment,
    namespace: env.namespace,
    storageMode: "memory-only",
    paymentMode: "simulated-only",
    documentMode: "watermarked-nonlegal",
    externalEffects: false
  });
  issuedBoundaries.add(boundary);
  return boundary;
}

function requireBoundary(boundary: ClosedDemoBoundary): ClosedDemoBoundary {
  if (!boundary || typeof boundary !== "object" || !issuedBoundaries.has(boundary)
      || boundary.scope !== "ENCHEV_CLOSED_DEMO" || boundary.externalEffects !== false) {
    reject("UNISSUED_BOUNDARY");
  }
  return boundary;
}

function requireTransactionId(value: string): string {
  if (typeof value !== "string" || !transactionIdPattern.test(value)) {
    reject("TRANSACTION_MUST_BE_DEMO_ONLY");
  }
  return value;
}

const documentKinds: readonly ClosedDemoDocumentKind[] = Object.freeze([
  "vehicle-intake", "seller-declaration", "auction-close", "purchase-summary",
  "pro-forma", "payment-confirmation", "vehicle-release", "handover", "completion"
]);

/** Metadata only. Does not create a document, PDF, invoice, signature or record. */
export function prepareClosedDemoDocument(
  boundary: ClosedDemoBoundary,
  transactionId: string,
  documentKind: ClosedDemoDocumentKind
): ClosedDemoDocument {
  const issued = requireBoundary(boundary);
  requireTransactionId(transactionId);
  if (!documentKinds.includes(documentKind)) reject("UNSUPPORTED_DEMO_DOCUMENT");
  return Object.freeze({
    kind: "DEMO_DOCUMENT_PREVIEW",
    documentKind,
    transactionId,
    namespace: issued.namespace,
    watermark: CLOSED_DEMO_DOCUMENT_WATERMARK,
    legalEffect: false,
    taxInvoice: false,
    storageMode: "memory-only"
  });
}

/** Metadata only. There is deliberately no URL, IBAN, provider token or pay action. */
export function prepareClosedDemoPayment(
  boundary: ClosedDemoBoundary,
  transactionId: string,
  amountMinor: number,
  currency: "EUR"
): ClosedDemoPayment {
  const issued = requireBoundary(boundary);
  requireTransactionId(transactionId);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) reject("INVALID_DEMO_AMOUNT");
  if (currency !== "EUR") reject("UNSUPPORTED_DEMO_CURRENCY");
  return Object.freeze({
    kind: "DEMO_PAYMENT_PREVIEW",
    transactionId,
    namespace: issued.namespace,
    amountMinor,
    currency: "EUR",
    state: "NOT_PAYABLE",
    provider: "NONE",
    canCharge: false,
    canSettle: false,
    hasPayableInstructions: false,
    storageMode: "memory-only"
  });
}

/** Reuse MISSION-002's unforgeable in-process boundary in dependent demo modules. */
export function requireIssuedClosedDemoBoundary(boundary: ClosedDemoBoundary): ClosedDemoBoundary {
  return requireBoundary(boundary);
}
