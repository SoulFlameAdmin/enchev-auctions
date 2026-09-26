export type NotificationKind =
  | "starting-soon"
  | "saved-search"
  | "bid-status"
  | "auction-status"
  | "generic";

export type NotificationCandidate = Readonly<{
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  occurredAt: string;
  payloadRef: string;
}>;

export type NotificationDeliveryLedgerEntry = Readonly<{
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  deliveredAt: string;
  expiresAt: string | null;
}>;

export type NotificationSuppressionResult = Readonly<{
  deliverable: readonly NotificationCandidate[];
  suppressed: readonly Readonly<{
    candidate: NotificationCandidate;
    reason: "batch-duplicate" | "already-delivered";
  }>[];
}>;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function instant(value:string,code:string):number{
  const n=Date.parse(value);
  if(!Number.isFinite(n)) throw new Error(code);
  return n;
}

function scopeKey(userId:string,kind:NotificationKind,dedupeKey:string):string{
  return `${userId}\u0000${kind}\u0000${dedupeKey}`;
}

export function suppressDuplicateNotifications(
  candidates: readonly NotificationCandidate[],
  ledger: readonly NotificationDeliveryLedgerEntry[],
  nowInput: string,
  maxCandidates = 1000,
  maxLedgerEntries = 5000,
): NotificationSuppressionResult {
  const nowMs=instant(nowInput,"NOTIFICATION_SUPPRESSION_NOW_INVALID");
  if(!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>10000) throw new Error("NOTIFICATION_SUPPRESSION_CANDIDATE_LIMIT_INVALID");
  if(!Number.isInteger(maxLedgerEntries)||maxLedgerEntries<1||maxLedgerEntries>50000) throw new Error("NOTIFICATION_SUPPRESSION_LEDGER_LIMIT_INVALID");
  if(candidates.length>maxCandidates) throw new Error("NOTIFICATION_SUPPRESSION_CANDIDATE_LIMIT_EXCEEDED");
  if(ledger.length>maxLedgerEntries) throw new Error("NOTIFICATION_SUPPRESSION_LEDGER_LIMIT_EXCEEDED");

  const activeDelivered=new Set<string>();
  for(const row of ledger){
    const userId=required(row.userId,"NOTIFICATION_LEDGER_USER_REQUIRED");
    const dedupeKey=required(row.dedupeKey,"NOTIFICATION_LEDGER_KEY_REQUIRED");
    instant(row.deliveredAt,"NOTIFICATION_LEDGER_DELIVERED_AT_INVALID");
    if(row.expiresAt!==null){
      const expiresMs=instant(row.expiresAt,"NOTIFICATION_LEDGER_EXPIRES_AT_INVALID");
      if(expiresMs<=nowMs) continue;
    }
    activeDelivered.add(scopeKey(userId,row.kind,dedupeKey));
  }

  const normalized=candidates.map(candidate=>{
    const userId=required(candidate.userId,"NOTIFICATION_CANDIDATE_USER_REQUIRED");
    const dedupeKey=required(candidate.dedupeKey,"NOTIFICATION_CANDIDATE_KEY_REQUIRED");
    const payloadRef=required(candidate.payloadRef,"NOTIFICATION_CANDIDATE_PAYLOAD_REQUIRED");
    const occurredMs=instant(candidate.occurredAt,"NOTIFICATION_CANDIDATE_OCCURRED_AT_INVALID");
    return Object.freeze({
      ...candidate,
      userId,
      dedupeKey,
      payloadRef,
      occurredAt:new Date(occurredMs).toISOString(),
    });
  }).sort((a,b)=>
    Date.parse(a.occurredAt)-Date.parse(b.occurredAt)
    ||a.userId.localeCompare(b.userId)
    ||a.kind.localeCompare(b.kind)
    ||a.dedupeKey.localeCompare(b.dedupeKey)
    ||a.payloadRef.localeCompare(b.payloadRef)
  );

  const seenBatch=new Set<string>();
  const deliverable:NotificationCandidate[]=[];
  const suppressed:Array<Readonly<{candidate:NotificationCandidate;reason:"batch-duplicate"|"already-delivered"}>>=[];

  for(const candidate of normalized){
    const key=scopeKey(candidate.userId,candidate.kind,candidate.dedupeKey);
    if(activeDelivered.has(key)){
      suppressed.push(Object.freeze({candidate,reason:"already-delivered"}));
      continue;
    }
    if(seenBatch.has(key)){
      suppressed.push(Object.freeze({candidate,reason:"batch-duplicate"}));
      continue;
    }
    seenBatch.add(key);
    deliverable.push(candidate);
  }

  return Object.freeze({
    deliverable:Object.freeze(deliverable),
    suppressed:Object.freeze(suppressed),
  });
}
