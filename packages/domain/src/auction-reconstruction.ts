import type {
  AcceptedBidChronologyItem,
  TrustRecordJson,
  VisibleAuctionRulesSnapshot,
  VisibleVehicleSnapshot,
} from "./auction-trust-record";

export type ReconstructionCorrelationId = string;

export type ExtensionTrustEvent = Readonly<{
  eventId: string;
  auctionId: string;
  vehicleId: string;
  triggerBidId: string;
  occurredAt: string;
  sequence: number;
  previousEndsAt: string;
  nextEndsAt: string;
  sourceRef: string;
  correlationId: ReconstructionCorrelationId;
}>;

export type ExtensionChronologyItem = ExtensionTrustEvent & Readonly<{ordinal:number}>;

export type FinalResultState = "provisional" | "seller-approval-pending" | "sold" | "unsold" | "void";
export type FinalResultTrustEvent = Readonly<{
  eventId: string;
  auctionId: string;
  vehicleId: string;
  state: FinalResultState;
  winningBidId: string | null;
  amountCents: number | null;
  currency: string | null;
  occurredAt: string;
  sequence: number;
  sourceRef: string;
  correlationId: ReconstructionCorrelationId;
}>;
export type FinalResultChronologyItem = FinalResultTrustEvent & Readonly<{ordinal:number}>;

export type SellerListingChangeTrustEvent = Readonly<{
  changeId: string;
  auctionId: string;
  vehicleId: string;
  listingId: string;
  actorRef: string;
  field: string;
  before: TrustRecordJson;
  after: TrustRecordJson;
  critical: boolean;
  revision: number;
  changedAt: string;
  sourceRef: string;
  correlationId: ReconstructionCorrelationId | null;
}>;
export type SellerListingChangeChronologyItem = SellerListingChangeTrustEvent & Readonly<{ordinal:number}>;

export type InspectionVersionTrustEvent = Readonly<{
  evidenceId: string;
  auctionId: string;
  vehicleId: string;
  reportId: string;
  version: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  capturedAt: string;
  inspectorRef: string;
  payloadSha256: string;
  sourceRef: string;
  correlationId: ReconstructionCorrelationId | null;
}>;
export type InspectionVersionChronologyItem = InspectionVersionTrustEvent & Readonly<{ordinal:number}>;

export type QaQuestionHistoryRecord = Readonly<{
  questionId: string;
  auctionId: string;
  vehicleId: string;
  askerRef: string;
  body: string;
  createdAt: string;
  status: "published" | "hidden";
  sourceRef: string;
  correlationId: ReconstructionCorrelationId | null;
}>;

export type QaReplyHistoryRecord = Readonly<{
  replyId: string;
  questionId: string;
  auctionId: string;
  vehicleId: string;
  sellerRef: string;
  body: string;
  createdAt: string;
  verifiedSeller: boolean;
  sourceRef: string;
  correlationId: ReconstructionCorrelationId | null;
}>;

export type PreservedQaHistory = Readonly<{
  auctionId: string;
  vehicleId: string;
  questions: readonly QaQuestionHistoryRecord[];
  replies: readonly QaReplyHistoryRecord[];
}>;

export type AdminExceptionalActionTrustEvent = Readonly<{
  actionId: string;
  auctionId: string;
  vehicleId: string;
  actorRef: string;
  action: string;
  reason: string;
  occurredAt: string;
  sequence: number;
  before: TrustRecordJson;
  after: TrustRecordJson;
  sourceRef: string;
  correlationId: ReconstructionCorrelationId;
}>;
export type AdminExceptionalActionChronologyItem = AdminExceptionalActionTrustEvent & Readonly<{ordinal:number}>;

export type ReconstructionAuditKind =
  | "accepted-bid"
  | "extension"
  | "final-result"
  | "seller-listing-change"
  | "inspection-version"
  | "qa-question"
  | "qa-reply"
  | "admin-exception";

export type ReconstructionAuditEntry = Readonly<{
  kind: ReconstructionAuditKind;
  eventId: string;
  auctionId: string;
  vehicleId: string;
  occurredAt: string;
  sequence: number;
  sourceRef: string;
  correlationId: string | null;
  payload: TrustRecordJson;
}>;

export type ImmutableAuditExport = Readonly<{
  exportVersion: 1;
  auctionId: string;
  vehicleId: string;
  generatedAt: string;
  entryCount: number;
  canonicalJson: string;
  sha256: string;
  entries: readonly ReconstructionAuditEntry[];
}>;

export type CorrelationIndexItem = Readonly<{
  correlationId: string;
  eventIds: readonly string[];
  kinds: readonly ReconstructionAuditKind[];
}>;

export type CriticalEventHashLink = Readonly<{
  ordinal: number;
  eventId: string;
  kind: "accepted-bid" | "extension" | "final-result" | "admin-exception";
  correlationId: string;
  previousHash: string;
  eventHash: string;
  chainHash: string;
}>;

export type DisputeEvidenceBundle = Readonly<{
  bundleVersion: 1;
  auctionId: string;
  vehicleId: string;
  generatedAt: string;
  rulesSnapshot: VisibleAuctionRulesSnapshot;
  vehicleSnapshot: VisibleVehicleSnapshot;
  acceptedBids: readonly AcceptedBidChronologyItem[];
  extensions: readonly ExtensionChronologyItem[];
  finalResults: readonly FinalResultChronologyItem[];
  sellerChanges: readonly SellerListingChangeChronologyItem[];
  inspectionVersions: readonly InspectionVersionChronologyItem[];
  qaHistory: PreservedQaHistory;
  adminActions: readonly AdminExceptionalActionChronologyItem[];
  correlations: readonly CorrelationIndexItem[];
  criticalHashChain: readonly CriticalEventHashLink[];
  auditExportSha256: string;
  bundleSha256: string;
}>;

export type CompleteAuctionReconstruction = Readonly<{
  auctionId: string;
  vehicleId: string;
  auditExport: ImmutableAuditExport;
  disputeBundle: DisputeEvidenceBundle;
}>;

function required(value:string, code:string):string{
  const normalized=String(value??"").trim();
  if(!normalized) throw new Error(code);
  return normalized;
}
function positiveInt(value:number, code:string):number{
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}
function nonNegativeInt(value:number, code:string):number{
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}
function utc(value:string, code:string):string{
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed)||!value.endsWith("Z")) throw new Error(code);
  const canonical=new Date(parsed).toISOString();
  if(canonical!==value) throw new Error(code);
  return canonical;
}
function currency(value:string|null, code:string):string|null{
  if(value===null)return null;
  if(!/^[A-Z]{3}$/.test(value))throw new Error(code);
  return value;
}
function sha(value:string, code:string):string{
  if(!/^[a-f0-9]{64}$/.test(value))throw new Error(code);
  return value;
}
function scope(auctionId:string,vehicleId:string,row:{auctionId:string;vehicleId:string},code:string){
  if(row.auctionId!==auctionId||row.vehicleId!==vehicleId)throw new Error(code);
}
function assertJson(value:unknown, path:string):asserts value is TrustRecordJson{
  if(value===null||typeof value==="string"||typeof value==="boolean")return;
  if(typeof value==="number"){if(!Number.isFinite(value))throw new Error(path+"_NON_FINITE");return;}
  if(Array.isArray(value)){value.forEach((item,index)=>assertJson(item,path+"_"+index));return;}
  if(typeof value==="object"&&value){
    for(const [key,item] of Object.entries(value)){required(key,path+"_KEY");assertJson(item,path+"_"+key);}
    return;
  }
  throw new Error(path+"_NOT_JSON");
}
function cloneJson(value:TrustRecordJson):TrustRecordJson{
  if(Array.isArray(value))return Object.freeze(value.map(cloneJson));
  if(value&&typeof value==="object"){
    const out:Record<string,TrustRecordJson>={};
    for(const key of Object.keys(value).sort())out[key]=cloneJson((value as Readonly<Record<string,TrustRecordJson>>)[key]);
    return Object.freeze(out);
  }
  return value;
}
function canonical(value:unknown):string{
  if(value===null)return "null";
  if(typeof value==="string"||typeof value==="boolean"||typeof value==="number")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  if(typeof value==="object"){
    const entries=Object.entries(value as Record<string,unknown>)
      .filter(([,v])=>v!==undefined)
      .sort(([a],[b])=>a.localeCompare(b));
    return "{"+entries.map(([k,v])=>JSON.stringify(k)+":"+canonical(v)).join(",")+"}";
  }
  throw new Error("CANONICAL_UNSUPPORTED_VALUE");
}
async function sha256Hex(value:string):Promise<string>{
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw new Error("CRYPTO_SUBTLE_UNAVAILABLE");
  const digest=await subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function immutableRows<T extends object>(rows:T[]):readonly Readonly<T>[]{
  return Object.freeze(rows.map(row=>Object.freeze(row)));
}
function chronologySort<T extends {occurredAt:string;sequence:number}>(rows:T[]):T[]{
  return rows.sort((a,b)=>a.sequence-b.sequence||Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
}

export function buildExtensionEventChronology(
  auctionIdInput:string,
  vehicleIdInput:string,
  input:readonly ExtensionTrustEvent[],
):readonly ExtensionChronologyItem[]{
  const auctionId=required(auctionIdInput,"EXT_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"EXT_VEHICLE_REQUIRED");
  const ids=new Set<string>(), sequences=new Set<number>();
  const rows=input.map(event=>{
    scope(auctionId,vehicleId,event,"EXT_SCOPE_MISMATCH");
    const eventId=required(event.eventId,"EXT_EVENT_ID_REQUIRED");
    required(event.triggerBidId,"EXT_TRIGGER_BID_REQUIRED");
    required(event.sourceRef,"EXT_SOURCE_REQUIRED");
    required(event.correlationId,"EXT_CORRELATION_REQUIRED");
    const occurredAt=utc(event.occurredAt,"EXT_OCCURRED_AT_INVALID");
    const previousEndsAt=utc(event.previousEndsAt,"EXT_PREVIOUS_END_INVALID");
    const nextEndsAt=utc(event.nextEndsAt,"EXT_NEXT_END_INVALID");
    const sequence=positiveInt(event.sequence,"EXT_SEQUENCE_INVALID");
    if(ids.has(eventId))throw new Error("EXT_DUPLICATE_EVENT");
    if(sequences.has(sequence))throw new Error("EXT_DUPLICATE_SEQUENCE");
    if(Date.parse(nextEndsAt)<=Date.parse(previousEndsAt))throw new Error("EXT_MUST_EXTEND_END_TIME");
    if(Date.parse(occurredAt)>Date.parse(nextEndsAt))throw new Error("EXT_EVENT_AFTER_NEW_END");
    ids.add(eventId);sequences.add(sequence);
    return {...event,eventId,occurredAt,previousEndsAt,nextEndsAt,sequence};
  });
  chronologySort(rows);
  for(let i=1;i<rows.length;i++){
    if(Date.parse(rows[i].occurredAt)<Date.parse(rows[i-1].occurredAt))throw new Error("EXT_TIME_REGRESSION");
    if(Date.parse(rows[i].nextEndsAt)<Date.parse(rows[i-1].nextEndsAt))throw new Error("EXT_DEADLINE_REGRESSION");
  }
  return immutableRows(rows.map((row,index)=>({...row,ordinal:index+1}))) as readonly ExtensionChronologyItem[];
}

export function buildFinalResultChronology(
  auctionIdInput:string,
  vehicleIdInput:string,
  input:readonly FinalResultTrustEvent[],
):readonly FinalResultChronologyItem[]{
  const auctionId=required(auctionIdInput,"RESULT_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"RESULT_VEHICLE_REQUIRED");
  const ids=new Set<string>(),sequences=new Set<number>();
  const rows=input.map(event=>{
    scope(auctionId,vehicleId,event,"RESULT_SCOPE_MISMATCH");
    const eventId=required(event.eventId,"RESULT_EVENT_ID_REQUIRED");
    required(event.sourceRef,"RESULT_SOURCE_REQUIRED");
    required(event.correlationId,"RESULT_CORRELATION_REQUIRED");
    const occurredAt=utc(event.occurredAt,"RESULT_OCCURRED_AT_INVALID");
    const sequence=positiveInt(event.sequence,"RESULT_SEQUENCE_INVALID");
    if(ids.has(eventId))throw new Error("RESULT_DUPLICATE_EVENT");
    if(sequences.has(sequence))throw new Error("RESULT_DUPLICATE_SEQUENCE");
    if(event.state==="sold"){
      if(!event.winningBidId)throw new Error("RESULT_SOLD_WINNING_BID_REQUIRED");
      if(!Number.isSafeInteger(event.amountCents)||Number(event.amountCents)<=0)throw new Error("RESULT_SOLD_AMOUNT_REQUIRED");
      if(currency(event.currency,"RESULT_CURRENCY_INVALID")===null)throw new Error("RESULT_SOLD_CURRENCY_REQUIRED");
    }else{
      if(event.amountCents!==null&&(!Number.isSafeInteger(event.amountCents)||event.amountCents<0))throw new Error("RESULT_AMOUNT_INVALID");
      currency(event.currency,"RESULT_CURRENCY_INVALID");
    }
    ids.add(eventId);sequences.add(sequence);
    return {...event,eventId,occurredAt,sequence};
  });
  chronologySort(rows);
  const terminal=new Set<FinalResultState>(["sold","unsold","void"]);
  let terminalSeen=false;
  for(let i=0;i<rows.length;i++){
    if(i>0&&Date.parse(rows[i].occurredAt)<Date.parse(rows[i-1].occurredAt))throw new Error("RESULT_TIME_REGRESSION");
    if(terminalSeen)throw new Error("RESULT_EVENT_AFTER_TERMINAL");
    if(terminal.has(rows[i].state))terminalSeen=true;
  }
  return immutableRows(rows.map((row,index)=>({...row,ordinal:index+1}))) as readonly FinalResultChronologyItem[];
}

export function buildSellerListingChangeChronology(
  auctionIdInput:string,
  vehicleIdInput:string,
  listingIdInput:string,
  input:readonly SellerListingChangeTrustEvent[],
):readonly SellerListingChangeChronologyItem[]{
  const auctionId=required(auctionIdInput,"SELLER_CHANGE_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"SELLER_CHANGE_VEHICLE_REQUIRED");
  const listingId=required(listingIdInput,"SELLER_CHANGE_LISTING_REQUIRED");
  const ids=new Set<string>(),revisions=new Set<number>();
  const rows=input.map(change=>{
    scope(auctionId,vehicleId,change,"SELLER_CHANGE_SCOPE_MISMATCH");
    const changeId=required(change.changeId,"SELLER_CHANGE_ID_REQUIRED");
    if(change.listingId!==listingId)throw new Error("SELLER_CHANGE_LISTING_MISMATCH");
    required(change.actorRef,"SELLER_CHANGE_ACTOR_REQUIRED");
    required(change.field,"SELLER_CHANGE_FIELD_REQUIRED");
    required(change.sourceRef,"SELLER_CHANGE_SOURCE_REQUIRED");
    if(change.correlationId!==null)required(change.correlationId,"SELLER_CHANGE_CORRELATION_INVALID");
    assertJson(change.before,"SELLER_CHANGE_BEFORE");
    assertJson(change.after,"SELLER_CHANGE_AFTER");
    const revision=positiveInt(change.revision,"SELLER_CHANGE_REVISION_INVALID");
    const changedAt=utc(change.changedAt,"SELLER_CHANGE_TIME_INVALID");
    if(ids.has(changeId))throw new Error("SELLER_CHANGE_DUPLICATE_ID");
    if(revisions.has(revision))throw new Error("SELLER_CHANGE_DUPLICATE_REVISION");
    ids.add(changeId);revisions.add(revision);
    return {...change,changeId,revision,changedAt,before:cloneJson(change.before),after:cloneJson(change.after)};
  }).sort((a,b)=>a.revision-b.revision||a.changeId.localeCompare(b.changeId));
  for(let i=0;i<rows.length;i++){
    if(rows[i].revision!==i+1)throw new Error("SELLER_CHANGE_REVISION_GAP");
    if(i>0&&Date.parse(rows[i].changedAt)<Date.parse(rows[i-1].changedAt))throw new Error("SELLER_CHANGE_TIME_REGRESSION");
  }
  return immutableRows(rows.map((row,index)=>({...row,ordinal:index+1}))) as readonly SellerListingChangeChronologyItem[];
}

export function buildInspectionVersionChronology(
  auctionIdInput:string,
  vehicleIdInput:string,
  reportIdInput:string,
  input:readonly InspectionVersionTrustEvent[],
):readonly InspectionVersionChronologyItem[]{
  const auctionId=required(auctionIdInput,"INSPECTION_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"INSPECTION_VEHICLE_REQUIRED");
  const reportId=required(reportIdInput,"INSPECTION_REPORT_REQUIRED");
  const evidenceIds=new Set<string>(),versions=new Set<number>();
  const rows=input.map(event=>{
    scope(auctionId,vehicleId,event,"INSPECTION_SCOPE_MISMATCH");
    const evidenceId=required(event.evidenceId,"INSPECTION_EVIDENCE_ID_REQUIRED");
    if(event.reportId!==reportId)throw new Error("INSPECTION_REPORT_MISMATCH");
    const version=positiveInt(event.version,"INSPECTION_VERSION_INVALID");
    required(event.inspectorRef,"INSPECTION_INSPECTOR_REQUIRED");
    required(event.sourceRef,"INSPECTION_SOURCE_REQUIRED");
    if(event.correlationId!==null)required(event.correlationId,"INSPECTION_CORRELATION_INVALID");
    const capturedAt=utc(event.capturedAt,"INSPECTION_CAPTURE_TIME_INVALID");
    sha(event.payloadSha256,"INSPECTION_PAYLOAD_HASH_INVALID");
    if(evidenceIds.has(evidenceId))throw new Error("INSPECTION_DUPLICATE_EVIDENCE");
    if(versions.has(version))throw new Error("INSPECTION_DUPLICATE_VERSION");
    evidenceIds.add(evidenceId);versions.add(version);
    return {...event,evidenceId,version,capturedAt};
  }).sort((a,b)=>a.version-b.version||a.evidenceId.localeCompare(b.evidenceId));
  for(let i=0;i<rows.length;i++){
    if(rows[i].version!==i+1)throw new Error("INSPECTION_VERSION_GAP");
    if(i>0&&Date.parse(rows[i].capturedAt)<Date.parse(rows[i-1].capturedAt))throw new Error("INSPECTION_TIME_REGRESSION");
  }
  return immutableRows(rows.map((row,index)=>({...row,ordinal:index+1}))) as readonly InspectionVersionChronologyItem[];
}

export function preserveQaHistory(
  auctionIdInput:string,
  vehicleIdInput:string,
  questionsInput:readonly QaQuestionHistoryRecord[],
  repliesInput:readonly QaReplyHistoryRecord[],
):PreservedQaHistory{
  const auctionId=required(auctionIdInput,"QA_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"QA_VEHICLE_REQUIRED");
  const questionIds=new Set<string>();
  const questions=questionsInput.map(q=>{
    scope(auctionId,vehicleId,q,"QA_QUESTION_SCOPE_MISMATCH");
    const questionId=required(q.questionId,"QA_QUESTION_ID_REQUIRED");
    required(q.askerRef,"QA_ASKER_REQUIRED");required(q.body,"QA_QUESTION_BODY_REQUIRED");required(q.sourceRef,"QA_QUESTION_SOURCE_REQUIRED");
    if(q.correlationId!==null)required(q.correlationId,"QA_QUESTION_CORRELATION_INVALID");
    const createdAt=utc(q.createdAt,"QA_QUESTION_TIME_INVALID");
    if(questionIds.has(questionId))throw new Error("QA_DUPLICATE_QUESTION");
    questionIds.add(questionId);
    return Object.freeze({...q,questionId,createdAt});
  }).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.questionId.localeCompare(b.questionId));
  const replyIds=new Set<string>();
  const replies=repliesInput.map(r=>{
    scope(auctionId,vehicleId,r,"QA_REPLY_SCOPE_MISMATCH");
    const replyId=required(r.replyId,"QA_REPLY_ID_REQUIRED");
    const questionId=required(r.questionId,"QA_REPLY_QUESTION_REQUIRED");
    if(!questionIds.has(questionId))throw new Error("QA_REPLY_ORPHAN");
    required(r.sellerRef,"QA_SELLER_REQUIRED");required(r.body,"QA_REPLY_BODY_REQUIRED");required(r.sourceRef,"QA_REPLY_SOURCE_REQUIRED");
    if(r.correlationId!==null)required(r.correlationId,"QA_REPLY_CORRELATION_INVALID");
    const createdAt=utc(r.createdAt,"QA_REPLY_TIME_INVALID");
    const question=questions.find(q=>q.questionId===questionId)!;
    if(Date.parse(createdAt)<Date.parse(question.createdAt))throw new Error("QA_REPLY_BEFORE_QUESTION");
    if(replyIds.has(replyId))throw new Error("QA_DUPLICATE_REPLY");
    replyIds.add(replyId);
    return Object.freeze({...r,replyId,questionId,createdAt});
  }).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.replyId.localeCompare(b.replyId));
  return Object.freeze({auctionId,vehicleId,questions:Object.freeze(questions),replies:Object.freeze(replies)});
}

export function buildAdminExceptionalActionChronology(
  auctionIdInput:string,
  vehicleIdInput:string,
  input:readonly AdminExceptionalActionTrustEvent[],
):readonly AdminExceptionalActionChronologyItem[]{
  const auctionId=required(auctionIdInput,"ADMIN_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"ADMIN_VEHICLE_REQUIRED");
  const ids=new Set<string>(),sequences=new Set<number>();
  const rows=input.map(action=>{
    scope(auctionId,vehicleId,action,"ADMIN_SCOPE_MISMATCH");
    const actionId=required(action.actionId,"ADMIN_ACTION_ID_REQUIRED");
    required(action.actorRef,"ADMIN_ACTOR_REQUIRED");required(action.action,"ADMIN_ACTION_REQUIRED");required(action.reason,"ADMIN_REASON_REQUIRED");
    required(action.sourceRef,"ADMIN_SOURCE_REQUIRED");required(action.correlationId,"ADMIN_CORRELATION_REQUIRED");
    assertJson(action.before,"ADMIN_BEFORE");assertJson(action.after,"ADMIN_AFTER");
    const occurredAt=utc(action.occurredAt,"ADMIN_TIME_INVALID");
    const sequence=positiveInt(action.sequence,"ADMIN_SEQUENCE_INVALID");
    if(ids.has(actionId))throw new Error("ADMIN_DUPLICATE_ACTION");
    if(sequences.has(sequence))throw new Error("ADMIN_DUPLICATE_SEQUENCE");
    ids.add(actionId);sequences.add(sequence);
    return {...action,actionId,occurredAt,sequence,before:cloneJson(action.before),after:cloneJson(action.after)};
  });
  chronologySort(rows);
  for(let i=1;i<rows.length;i++)if(Date.parse(rows[i].occurredAt)<Date.parse(rows[i-1].occurredAt))throw new Error("ADMIN_TIME_REGRESSION");
  return immutableRows(rows.map((row,index)=>({...row,ordinal:index+1}))) as readonly AdminExceptionalActionChronologyItem[];
}

function normalizeAuditEntry(
  auctionId:string,
  vehicleId:string,
  entry:ReconstructionAuditEntry,
):ReconstructionAuditEntry{
  scope(auctionId,vehicleId,entry,"AUDIT_SCOPE_MISMATCH");
  const eventId=required(entry.eventId,"AUDIT_EVENT_ID_REQUIRED");
  const sourceRef=required(entry.sourceRef,"AUDIT_SOURCE_REQUIRED");
  const occurredAt=utc(entry.occurredAt,"AUDIT_TIME_INVALID");
  const sequence=nonNegativeInt(entry.sequence,"AUDIT_SEQUENCE_INVALID");
  if(entry.correlationId!==null)required(entry.correlationId,"AUDIT_CORRELATION_INVALID");
  assertJson(entry.payload,"AUDIT_PAYLOAD");
  return Object.freeze({...entry,eventId,sourceRef,occurredAt,sequence,payload:cloneJson(entry.payload)});
}

export async function createImmutableAuditExport(
  auctionIdInput:string,
  vehicleIdInput:string,
  generatedAtInput:string,
  input:readonly ReconstructionAuditEntry[],
):Promise<ImmutableAuditExport>{
  const auctionId=required(auctionIdInput,"AUDIT_AUCTION_REQUIRED");
  const vehicleId=required(vehicleIdInput,"AUDIT_VEHICLE_REQUIRED");
  const generatedAt=utc(generatedAtInput,"AUDIT_GENERATED_AT_INVALID");
  const ids=new Set<string>();
  const entries=input.map(entry=>{
    const normalized=normalizeAuditEntry(auctionId,vehicleId,entry);
    const key=normalized.kind+":"+normalized.eventId;
    if(ids.has(key))throw new Error("AUDIT_DUPLICATE_EVENT");
    ids.add(key);return normalized;
  }).sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence||a.kind.localeCompare(b.kind)||a.eventId.localeCompare(b.eventId));
  if(entries.some(entry=>Date.parse(entry.occurredAt)>Date.parse(generatedAt)))throw new Error("AUDIT_EVENT_AFTER_EXPORT");
  const frozenEntries=Object.freeze(entries);
  const canonicalJson=canonical({exportVersion:1,auctionId,vehicleId,generatedAt,entries:frozenEntries});
  const digest=await sha256Hex(canonicalJson);
  return Object.freeze({exportVersion:1,auctionId,vehicleId,generatedAt,entryCount:entries.length,canonicalJson,sha256:digest,entries:frozenEntries});
}

const criticalKinds=new Set<ReconstructionAuditKind>(["accepted-bid","extension","final-result","admin-exception"]);

export function buildCorrelationIndex(input:readonly ReconstructionAuditEntry[]):readonly CorrelationIndexItem[]{
  const map=new Map<string,{eventIds:Set<string>;kinds:Set<ReconstructionAuditKind>}>();
  for(const entry of input){
    const correlationId=entry.correlationId;
    if(criticalKinds.has(entry.kind)&&correlationId===null)throw new Error("CORRELATION_REQUIRED_FOR_CRITICAL_EVENT");
    if(correlationId===null)continue;
    const id=required(correlationId,"CORRELATION_ID_INVALID");
    const current=map.get(id)??{eventIds:new Set<string>(),kinds:new Set<ReconstructionAuditKind>()};
    current.eventIds.add(required(entry.eventId,"CORRELATION_EVENT_ID_REQUIRED"));
    current.kinds.add(entry.kind);map.set(id,current);
  }
  return Object.freeze([...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([correlationId,value])=>Object.freeze({
    correlationId,
    eventIds:Object.freeze([...value.eventIds].sort()),
    kinds:Object.freeze([...value.kinds].sort()),
  })));
}

export async function buildCriticalEventHashChain(
  input:readonly ReconstructionAuditEntry[],
):Promise<readonly CriticalEventHashLink[]>{
  const critical=input.filter(entry=>criticalKinds.has(entry.kind)).slice().sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence||a.eventId.localeCompare(b.eventId));
  let previousHash="0".repeat(64);
  const links:CriticalEventHashLink[]=[];
  for(let i=0;i<critical.length;i++){
    const event=critical[i];
    if(event.correlationId===null)throw new Error("HASH_CHAIN_CORRELATION_REQUIRED");
    const eventHash=await sha256Hex(canonical({
      kind:event.kind,eventId:event.eventId,auctionId:event.auctionId,vehicleId:event.vehicleId,
      occurredAt:event.occurredAt,sequence:event.sequence,sourceRef:event.sourceRef,
      correlationId:event.correlationId,payload:event.payload,
    }));
    const chainHash=await sha256Hex(previousHash+":"+eventHash);
    links.push(Object.freeze({
      ordinal:i+1,eventId:event.eventId,
      kind:event.kind as CriticalEventHashLink["kind"],
      correlationId:event.correlationId,previousHash,eventHash,chainHash,
    }));
    previousHash=chainHash;
  }
  return Object.freeze(links);
}

function auditEntriesFromReconstruction(input:Readonly<{
  auctionId:string;
  vehicleId:string;
  acceptedBids:readonly AcceptedBidChronologyItem[];
  extensions:readonly ExtensionChronologyItem[];
  finalResults:readonly FinalResultChronologyItem[];
  sellerChanges:readonly SellerListingChangeChronologyItem[];
  inspectionVersions:readonly InspectionVersionChronologyItem[];
  qaHistory:PreservedQaHistory;
  adminActions:readonly AdminExceptionalActionChronologyItem[];
}>):readonly ReconstructionAuditEntry[]{
  const rows:ReconstructionAuditEntry[]=[];
  for(const b of input.acceptedBids)rows.push(Object.freeze({
    kind:"accepted-bid",eventId:b.bidId,auctionId:b.auctionId,vehicleId:b.vehicleId,occurredAt:b.occurredAt,sequence:b.sequence,
    sourceRef:b.sourceRef,correlationId:b.correlationId,payload:cloneJson({amountCents:b.amountCents,currency:b.currency,bidderRef:b.bidderRef}),
  }));
  for(const e of input.extensions)rows.push(Object.freeze({
    kind:"extension",eventId:e.eventId,auctionId:e.auctionId,vehicleId:e.vehicleId,occurredAt:e.occurredAt,sequence:e.sequence,
    sourceRef:e.sourceRef,correlationId:e.correlationId,payload:cloneJson({triggerBidId:e.triggerBidId,previousEndsAt:e.previousEndsAt,nextEndsAt:e.nextEndsAt}),
  }));
  for(const r of input.finalResults)rows.push(Object.freeze({
    kind:"final-result",eventId:r.eventId,auctionId:r.auctionId,vehicleId:r.vehicleId,occurredAt:r.occurredAt,sequence:r.sequence,
    sourceRef:r.sourceRef,correlationId:r.correlationId,payload:cloneJson({state:r.state,winningBidId:r.winningBidId,amountCents:r.amountCents,currency:r.currency}),
  }));
  for(const c of input.sellerChanges)rows.push(Object.freeze({
    kind:"seller-listing-change",eventId:c.changeId,auctionId:c.auctionId,vehicleId:c.vehicleId,occurredAt:c.changedAt,sequence:c.revision,
    sourceRef:c.sourceRef,correlationId:c.correlationId,payload:cloneJson({listingId:c.listingId,actorRef:c.actorRef,field:c.field,before:c.before,after:c.after,critical:c.critical}),
  }));
  for(const i of input.inspectionVersions)rows.push(Object.freeze({
    kind:"inspection-version",eventId:i.evidenceId,auctionId:i.auctionId,vehicleId:i.vehicleId,occurredAt:i.capturedAt,sequence:i.version,
    sourceRef:i.sourceRef,correlationId:i.correlationId,payload:cloneJson({reportId:i.reportId,status:i.status,inspectorRef:i.inspectorRef,payloadSha256:i.payloadSha256}),
  }));
  for(const q of input.qaHistory.questions)rows.push(Object.freeze({
    kind:"qa-question",eventId:q.questionId,auctionId:q.auctionId,vehicleId:q.vehicleId,occurredAt:q.createdAt,sequence:0,
    sourceRef:q.sourceRef,correlationId:q.correlationId,payload:cloneJson({askerRef:q.askerRef,body:q.body,status:q.status}),
  }));
  for(const r of input.qaHistory.replies)rows.push(Object.freeze({
    kind:"qa-reply",eventId:r.replyId,auctionId:r.auctionId,vehicleId:r.vehicleId,occurredAt:r.createdAt,sequence:0,
    sourceRef:r.sourceRef,correlationId:r.correlationId,payload:cloneJson({questionId:r.questionId,sellerRef:r.sellerRef,body:r.body,verifiedSeller:r.verifiedSeller}),
  }));
  for(const a of input.adminActions)rows.push(Object.freeze({
    kind:"admin-exception",eventId:a.actionId,auctionId:a.auctionId,vehicleId:a.vehicleId,occurredAt:a.occurredAt,sequence:a.sequence,
    sourceRef:a.sourceRef,correlationId:a.correlationId,payload:cloneJson({actorRef:a.actorRef,action:a.action,reason:a.reason,before:a.before,after:a.after}),
  }));
  return Object.freeze(rows);
}

export async function createDisputeEvidenceBundle(input:Readonly<{
  auctionId:string;
  vehicleId:string;
  generatedAt:string;
  rulesSnapshot:VisibleAuctionRulesSnapshot;
  vehicleSnapshot:VisibleVehicleSnapshot;
  acceptedBids:readonly AcceptedBidChronologyItem[];
  extensions:readonly ExtensionChronologyItem[];
  finalResults:readonly FinalResultChronologyItem[];
  sellerChanges:readonly SellerListingChangeChronologyItem[];
  inspectionVersions:readonly InspectionVersionChronologyItem[];
  qaHistory:PreservedQaHistory;
  adminActions:readonly AdminExceptionalActionChronologyItem[];
  auditExport:ImmutableAuditExport;
  correlations:readonly CorrelationIndexItem[];
  criticalHashChain:readonly CriticalEventHashLink[];
}>):Promise<DisputeEvidenceBundle>{
  const auctionId=required(input.auctionId,"BUNDLE_AUCTION_REQUIRED");
  const vehicleId=required(input.vehicleId,"BUNDLE_VEHICLE_REQUIRED");
  const generatedAt=utc(input.generatedAt,"BUNDLE_GENERATED_AT_INVALID");
  if(input.rulesSnapshot.auctionId!==auctionId)throw new Error("BUNDLE_RULES_SCOPE_MISMATCH");
  if(input.vehicleSnapshot.auctionId!==auctionId||input.vehicleSnapshot.vehicleId!==vehicleId)throw new Error("BUNDLE_VEHICLE_SCOPE_MISMATCH");
  if(input.auditExport.auctionId!==auctionId||input.auditExport.vehicleId!==vehicleId)throw new Error("BUNDLE_AUDIT_SCOPE_MISMATCH");
  if(input.qaHistory.auctionId!==auctionId||input.qaHistory.vehicleId!==vehicleId)throw new Error("BUNDLE_QA_SCOPE_MISMATCH");
  const body={
    bundleVersion:1 as const,auctionId,vehicleId,generatedAt,
    rulesSnapshot:input.rulesSnapshot,vehicleSnapshot:input.vehicleSnapshot,
    acceptedBids:input.acceptedBids,extensions:input.extensions,finalResults:input.finalResults,
    sellerChanges:input.sellerChanges,inspectionVersions:input.inspectionVersions,qaHistory:input.qaHistory,
    adminActions:input.adminActions,correlations:input.correlations,criticalHashChain:input.criticalHashChain,
    auditExportSha256:input.auditExport.sha256,
  };
  const bundleSha256=await sha256Hex(canonical(body));
  return Object.freeze({...body,bundleSha256});
}

export async function completeAuctionReconstruction(input:Readonly<{
  auctionId:string;
  vehicleId:string;
  generatedAt:string;
  rulesSnapshot:VisibleAuctionRulesSnapshot;
  vehicleSnapshot:VisibleVehicleSnapshot;
  acceptedBids:readonly AcceptedBidChronologyItem[];
  extensions:readonly ExtensionChronologyItem[];
  finalResults:readonly FinalResultChronologyItem[];
  sellerChanges:readonly SellerListingChangeChronologyItem[];
  inspectionVersions:readonly InspectionVersionChronologyItem[];
  qaHistory:PreservedQaHistory;
  adminActions:readonly AdminExceptionalActionChronologyItem[];
}>):Promise<CompleteAuctionReconstruction>{
  const auctionId=required(input.auctionId,"RECONSTRUCTION_AUCTION_REQUIRED");
  const vehicleId=required(input.vehicleId,"RECONSTRUCTION_VEHICLE_REQUIRED");
  if(input.finalResults.length===0)throw new Error("RECONSTRUCTION_RESULT_REQUIRED");
  const lastResult=input.finalResults[input.finalResults.length-1];
  if(!["sold","unsold","void"].includes(lastResult.state))throw new Error("RECONSTRUCTION_TERMINAL_RESULT_REQUIRED");
  const entries=auditEntriesFromReconstruction({...input,auctionId,vehicleId});
  const correlations=buildCorrelationIndex(entries);
  const criticalHashChain=await buildCriticalEventHashChain(entries);
  const auditExport=await createImmutableAuditExport(auctionId,vehicleId,input.generatedAt,entries);
  const disputeBundle=await createDisputeEvidenceBundle({...input,auctionId,vehicleId,auditExport,correlations,criticalHashChain});
  return Object.freeze({auctionId,vehicleId,auditExport,disputeBundle});
}
