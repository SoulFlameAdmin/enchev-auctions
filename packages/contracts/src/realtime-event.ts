export type EnchevRealtimeEvent = {
  id: string;
  type: string;
  source: "enchev-auctions";
  subject: string;
  time: string;
  sequence: number;
  schemaVersion: number;
  correlationId: string;
  data: Record<string, unknown>;
};

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SUBJECT_RE = /^auction\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function isEnchevRealtimeEvent(
  value: unknown,
  allowedTypes: ReadonlyMap<string, number>,
): value is EnchevRealtimeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["id","type","source","subject","time","sequence","schemaVersion","correlationId","data"];
  if (Object.keys(record).some((key) => !keys.includes(key))) return false;
  if (keys.some((key) => !(key in record))) return false;
  if (typeof record.id !== "string" || !ID_RE.test(record.id)) return false;
  if (typeof record.type !== "string") return false;
  const expectedSchema = allowedTypes.get(record.type);
  if (!expectedSchema || record.schemaVersion !== expectedSchema) return false;
  if (record.source !== "enchev-auctions") return false;
  if (typeof record.subject !== "string" || !SUBJECT_RE.test(record.subject)) return false;
  if (typeof record.time !== "string" || !Number.isFinite(Date.parse(record.time))) return false;
  if (!Number.isSafeInteger(record.sequence) || (record.sequence as number) < 1) return false;
  if (typeof record.correlationId !== "string" || !ID_RE.test(record.correlationId)) return false;
  if (!record.data || typeof record.data !== "object" || Array.isArray(record.data)) return false;
  return true;
}

export function decideRealtimeSequence(
  lastAppliedSequence: number | null,
  incomingSequence: number,
): "apply" | "duplicate" | "resync" {
  if (!Number.isSafeInteger(incomingSequence) || incomingSequence < 1) throw new Error("REALTIME_SEQUENCE_INVALID");
  if (lastAppliedSequence === null) return incomingSequence === 1 ? "apply" : "resync";
  if (!Number.isSafeInteger(lastAppliedSequence) || lastAppliedSequence < 1) throw new Error("REALTIME_SEQUENCE_STATE_INVALID");
  if (incomingSequence <= lastAppliedSequence) return "duplicate";
  if (incomingSequence === lastAppliedSequence + 1) return "apply";
  return "resync";
}
