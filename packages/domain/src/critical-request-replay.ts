export type CriticalOperation =
  | "bid.submit"
  | "auction.finalize"
  | "seller.reserve.update"
  | "admin.privilege.change";

export type CriticalRequestRecord = Readonly<{
  actorId: string;
  operation: CriticalOperation;
  idempotencyKey: string;
  requestFingerprint: string;
  state: "in-progress" | "completed";
  startedAtMs: number;
  completedAtMs: number | null;
  responseStatus: number | null;
  responseRef: string | null;
  effectRef: string | null;
}>;

export type CriticalRequestLedger = Readonly<{
  records: readonly CriticalRequestRecord[];
}>;

export type CriticalRequestBeginResult =
  | Readonly<{ action:"execute"; state:CriticalRequestLedger; record:CriticalRequestRecord }>
  | Readonly<{ action:"replay"; state:CriticalRequestLedger; record:CriticalRequestRecord }>;

const KEY_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FP_RE=/^sha256:[a-f0-9]{64}$/;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function nonNegativeInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}

function statusCode(value:number):number{
  if(!Number.isSafeInteger(value)||value<100||value>599) throw new Error("CRITICAL_REQUEST_RESPONSE_STATUS_INVALID");
  return value;
}

function validateKey(value:string):string{
  const key=required(value,"CRITICAL_REQUEST_IDEMPOTENCY_KEY_REQUIRED");
  if(!KEY_RE.test(key)) throw new Error("IDEMPOTENCY_KEY_INVALID");
  return key;
}

function validateFingerprint(value:string):string{
  const fingerprint=required(value,"CRITICAL_REQUEST_FINGERPRINT_REQUIRED");
  if(!FP_RE.test(fingerprint)) throw new Error("CRITICAL_REQUEST_FINGERPRINT_INVALID");
  return fingerprint;
}

function validateOperation(value:CriticalOperation):CriticalOperation{
  const allowed:readonly CriticalOperation[]=[
    "bid.submit",
    "auction.finalize",
    "seller.reserve.update",
    "admin.privilege.change",
  ];
  if(!allowed.includes(value)) throw new Error("CRITICAL_REQUEST_OPERATION_UNKNOWN");
  return value;
}

function scopeMatch(
  record:CriticalRequestRecord,
  actorId:string,
  operation:CriticalOperation,
  idempotencyKey:string,
):boolean{
  return record.actorId===actorId
    && record.operation===operation
    && record.idempotencyKey===idempotencyKey;
}

export function emptyCriticalRequestLedger():CriticalRequestLedger{
  return Object.freeze({records:Object.freeze([])});
}

export function beginCriticalRequest(
  ledger:CriticalRequestLedger,
  input:Readonly<{
    actorId:string;
    operation:CriticalOperation;
    idempotencyKey:string;
    requestFingerprint:string;
    nowMs:number;
  }>,
):CriticalRequestBeginResult{
  const actorId=required(input.actorId,"CRITICAL_REQUEST_ACTOR_REQUIRED");
  const operation=validateOperation(input.operation);
  const idempotencyKey=validateKey(input.idempotencyKey);
  const requestFingerprint=validateFingerprint(input.requestFingerprint);
  const nowMs=nonNegativeInt(input.nowMs,"CRITICAL_REQUEST_NOW_INVALID");

  const existing=ledger.records.find(record=>scopeMatch(record,actorId,operation,idempotencyKey));
  if(existing){
    if(existing.requestFingerprint!==requestFingerprint){
      throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
    }
    if(existing.state==="in-progress"){
      throw new Error("IDEMPOTENCY_REQUEST_IN_PROGRESS");
    }
    return Object.freeze({action:"replay",state:ledger,record:existing});
  }

  const record:CriticalRequestRecord=Object.freeze({
    actorId,
    operation,
    idempotencyKey,
    requestFingerprint,
    state:"in-progress",
    startedAtMs:nowMs,
    completedAtMs:null,
    responseStatus:null,
    responseRef:null,
    effectRef:null,
  });

  return Object.freeze({
    action:"execute",
    state:Object.freeze({records:Object.freeze([...ledger.records,record])}),
    record,
  });
}

export function completeCriticalRequest(
  ledger:CriticalRequestLedger,
  input:Readonly<{
    actorId:string;
    operation:CriticalOperation;
    idempotencyKey:string;
    requestFingerprint:string;
    nowMs:number;
    responseStatus:number;
    responseRef:string;
    effectRef:string;
  }>,
):CriticalRequestLedger{
  const actorId=required(input.actorId,"CRITICAL_REQUEST_ACTOR_REQUIRED");
  const operation=validateOperation(input.operation);
  const idempotencyKey=validateKey(input.idempotencyKey);
  const requestFingerprint=validateFingerprint(input.requestFingerprint);
  const nowMs=nonNegativeInt(input.nowMs,"CRITICAL_REQUEST_NOW_INVALID");
  const responseStatus=statusCode(input.responseStatus);
  const responseRef=required(input.responseRef,"CRITICAL_REQUEST_RESPONSE_REF_REQUIRED");
  const effectRef=required(input.effectRef,"CRITICAL_REQUEST_EFFECT_REF_REQUIRED");

  const index=ledger.records.findIndex(record=>scopeMatch(record,actorId,operation,idempotencyKey));
  if(index<0) throw new Error("CRITICAL_REQUEST_RECORD_NOT_FOUND");
  const existing=ledger.records[index];
  if(existing.requestFingerprint!==requestFingerprint){
    throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
  }
  if(nowMs<existing.startedAtMs) throw new Error("CRITICAL_REQUEST_TIME_REGRESSION");

  if(existing.state==="completed"){
    const sameCompletion=existing.responseStatus===responseStatus
      && existing.responseRef===responseRef
      && existing.effectRef===effectRef;
    if(!sameCompletion) throw new Error("CRITICAL_REQUEST_COMPLETION_CONFLICT");
    return ledger;
  }

  const duplicateEffect=ledger.records.some((record,recordIndex)=>
    recordIndex!==index
    && record.state==="completed"
    && record.effectRef===effectRef
  );
  if(duplicateEffect) throw new Error("CRITICAL_REQUEST_EFFECT_REF_REUSED");

  const completed:CriticalRequestRecord=Object.freeze({
    ...existing,
    state:"completed",
    completedAtMs:nowMs,
    responseStatus,
    responseRef,
    effectRef,
  });

  const records=ledger.records.map((record,recordIndex)=>recordIndex===index?completed:record);
  return Object.freeze({records:Object.freeze(records)});
}

export function replayCriticalRequestResponse(
  ledger:CriticalRequestLedger,
  input:Readonly<{
    actorId:string;
    operation:CriticalOperation;
    idempotencyKey:string;
    requestFingerprint:string;
  }>,
):Readonly<{responseStatus:number;responseRef:string;effectRef:string}>{
  const actorId=required(input.actorId,"CRITICAL_REQUEST_ACTOR_REQUIRED");
  const operation=validateOperation(input.operation);
  const idempotencyKey=validateKey(input.idempotencyKey);
  const requestFingerprint=validateFingerprint(input.requestFingerprint);
  const existing=ledger.records.find(record=>scopeMatch(record,actorId,operation,idempotencyKey));
  if(!existing) throw new Error("CRITICAL_REQUEST_RECORD_NOT_FOUND");
  if(existing.requestFingerprint!==requestFingerprint) throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
  if(existing.state!=="completed") throw new Error("IDEMPOTENCY_REQUEST_IN_PROGRESS");
  if(existing.responseStatus===null||existing.responseRef===null||existing.effectRef===null){
    throw new Error("CRITICAL_REQUEST_COMPLETION_CORRUPT");
  }
  return Object.freeze({
    responseStatus:existing.responseStatus,
    responseRef:existing.responseRef,
    effectRef:existing.effectRef,
  });
}
