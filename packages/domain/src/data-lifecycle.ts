export type DataSensitivity = "DC-0" | "DC-1" | "DC-2" | "DC-3";
export type AccessOutcome = "allowed" | "denied";
export type ExportWorkflowState =
  | "requested"
  | "identity-verified"
  | "collecting"
  | "reviewed"
  | "ready"
  | "delivered"
  | "expired"
  | "rejected";

export type SensitiveAccessEvent = Readonly<{
  event_id: string;
  occurred_at: string;
  actor_id: string;
  subject_id: string;
  resource_type: string;
  resource_id: string;
  purpose: string;
  sensitivity: DataSensitivity;
  action: string;
  outcome: AccessOutcome;
  correlation_id: string;
}>;

const REDACTED = "[REDACTED]" as const;
const ANONYMIZED = "[ANONYMIZED]" as const;
const SENSITIVE_KEY = /(password|passcode|token|secret|authorization|cookie|api[_-]?key|mfa|private[_-]?max[_-]?bid|kyc[_-]?document)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return value.replace(EMAIL, REDACTED).replace(BEARER, REDACTED);
  if (Array.isArray(value)) return value.map((item) => redactForLog(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redactForLog(nested, depth + 1),
      ]),
    );
  }
  return value;
}

export function anonymizeDirectIdentifiers<T extends Record<string, unknown>>(
  record: T,
  fields: readonly string[] = ["name", "email", "phone", "telephone", "address", "ip_address", "device_id"],
): T {
  const next = { ...record };
  for (const field of fields) {
    if (field in next) next[field as keyof T] = ANONYMIZED as T[keyof T];
  }
  return next;
}

export function createSensitiveAccessEvent(input: SensitiveAccessEvent): SensitiveAccessEvent {
  const required = Object.entries(input);
  if (required.some(([, value]) => typeof value !== "string" || value.trim() === "")) {
    throw new Error("SENSITIVE_ACCESS_EVENT_INVALID");
  }
  if (!/^DC-[0-3]$/.test(input.sensitivity)) throw new Error("SENSITIVE_ACCESS_EVENT_SENSITIVITY_INVALID");
  return Object.freeze({ ...input });
}

export type SubjectExportRecord = Readonly<{
  source: string;
  subject_id: string;
  sensitivity: Exclude<DataSensitivity, "DC-3">;
  data: Readonly<Record<string, unknown>>;
}>;

export function buildSubjectExportBundle(args: Readonly<{
  subjectId: string;
  identityVerified: boolean;
  records: readonly SubjectExportRecord[];
  generatedAt: string;
}>): Readonly<{
  subject_id: string;
  generated_at: string;
  sources: readonly string[];
  records: readonly SubjectExportRecord[];
}> {
  if (!args.identityVerified) throw new Error("SUBJECT_EXPORT_IDENTITY_NOT_VERIFIED");
  if (!args.subjectId.trim()) throw new Error("SUBJECT_EXPORT_SUBJECT_REQUIRED");
  const records = args.records.filter((record) => record.subject_id === args.subjectId && String(record.sensitivity) !== "DC-3");
  if (records.length !== args.records.length) throw new Error("SUBJECT_EXPORT_SCOPE_OR_SECRET_VIOLATION");
  return Object.freeze({
    subject_id: args.subjectId,
    generated_at: args.generatedAt,
    sources: Object.freeze([...new Set(records.map((record) => record.source))].sort()),
    records: Object.freeze([...records]),
  });
}

export function canDeleteSubjectData(args: Readonly<{
  legalHoldActive: boolean;
  immutableAuthorityRequired: boolean;
}>): "delete" | "anonymize" | "blocked-by-legal-hold" {
  if (args.legalHoldActive) return "blocked-by-legal-hold";
  if (args.immutableAuthorityRequired) return "anonymize";
  return "delete";
}
