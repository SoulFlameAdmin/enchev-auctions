export type SellerAnswerMediaKind = "qa-image" | "qa-video" | "qa-document";

export type SellerAnswerMedia = Readonly<{
  id: string;
  kind: SellerAnswerMediaKind;
  uri: string;
}>;

export type SellerVerification = Readonly<{
  sellerId: string;
  verificationId: string;
  status: "verified" | "revoked";
  verifiedAt: string;
}>;

export type SellerVerifiedReply = Readonly<{
  replyId: string;
  questionId: string;
  vehicleId: string;
  sellerId: string;
  body: string;
  createdAt: string;
  verifiedSeller: true;
  media: readonly SellerAnswerMedia[];
}>;

export type QuestionModerationAction = "hide" | "restore";
export type QuestionModerationRecord = Readonly<{
  moderationId: string;
  questionId: string;
  moderatorId: string;
  action: QuestionModerationAction;
  reason: string;
  occurredAt: string;
}>;

export type SellerLivePresenceState = "online" | "away" | "offline";
export type SellerLiveAuctionPresence = Readonly<{
  sellerId: string;
  auctionId: string;
  connectionId: string;
  state: SellerLivePresenceState;
  sequence: number;
  observedAt: string;
}>;

export type ViewingRequestStatus = "requested" | "accepted" | "declined" | "cancelled" | "completed";
export type ViewingRequest = Readonly<{
  requestId: string;
  listingId: string;
  vehicleId: string;
  buyerId: string;
  sellerId: string;
  requestedAt: string;
  scheduledFor: string | null;
  status: ViewingRequestStatus;
  updatedAt: string;
}>;

export type ReserveState = Readonly<{
  listingId: string;
  sellerId: string;
  reserveCents: number;
  revision: number;
  updatedAt: string;
  appliedMutationIds: readonly string[];
}>;

export type ReserveLoweringInput = Readonly<{
  sellerId: string;
  mutationId: string;
  expectedRevision: number;
  newReserveCents: number;
  occurredAt: string;
}>;

export type ReserveNotMetFollowUpStatus = "pending" | "accept-highest-bid" | "relist" | "withdraw" | "expired";
export type ReserveNotMetFollowUp = Readonly<{
  followUpId: string;
  listingId: string;
  sellerId: string;
  reserveCents: number;
  highestBidCents: number;
  status: ReserveNotMetFollowUpStatus;
  openedAt: string;
  updatedAt: string;
}>;

export type ListingChange = Readonly<{
  changeId: string;
  listingId: string;
  actorId: string;
  field: string;
  before: string | null;
  after: string | null;
  critical: boolean;
  sequence: number;
  changedAt: string;
}>;

export type ListingPublicationState = "draft" | "published" | "pending-review";

export type SellerResponseNotification = Readonly<{
  notificationId: string;
  replyId: string;
  recipientUserId: string;
  channel: "in-app" | "email";
  createdAt: string;
  dedupeKey: string;
}>;

type QuestionRef = Readonly<{
  questionId: string;
  vehicleId: string;
  askerUserId: string;
  createdAt: string;
  status: "published" | "hidden";
}>;

function required(value:string, code:string):string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function iso(value:string, code:string):string {
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error(code);
  return new Date(ms).toISOString();
}

function positiveInt(value:number, code:string):number {
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}

function nonNegativeInt(value:number, code:string):number {
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}

function normalizeAnswerMedia(media:readonly SellerAnswerMedia[]):readonly SellerAnswerMedia[] {
  if(media.length>10) throw new Error("SELLER_REPLY_MEDIA_LIMIT");
  const normalized=media.map(item=>Object.freeze({
    id:required(item.id,"SELLER_REPLY_MEDIA_ID_REQUIRED"),
    kind:item.kind,
    uri:required(item.uri,"SELLER_REPLY_MEDIA_URI_REQUIRED"),
  }));
  if(new Set(normalized.map(x=>x.id)).size!==normalized.length) throw new Error("SELLER_REPLY_MEDIA_ID_DUPLICATE");
  return Object.freeze([...normalized].sort((a,b)=>a.id.localeCompare(b.id)));
}

export function addSellerVerifiedReply(
  current:readonly SellerVerifiedReply[],
  questions:readonly QuestionRef[],
  verificationInput:SellerVerification,
  input:Omit<SellerVerifiedReply,"verifiedSeller">,
):readonly SellerVerifiedReply[] {
  const sellerId=required(verificationInput.sellerId,"SELLER_VERIFICATION_SELLER_REQUIRED");
  required(verificationInput.verificationId,"SELLER_VERIFICATION_ID_REQUIRED");
  iso(verificationInput.verifiedAt,"SELLER_VERIFICATION_TIME_INVALID");
  if(verificationInput.status!=="verified") throw new Error("SELLER_VERIFICATION_REQUIRED");

  const replyId=required(input.replyId,"SELLER_REPLY_ID_REQUIRED");
  const questionId=required(input.questionId,"SELLER_REPLY_QUESTION_REQUIRED");
  const vehicleId=required(input.vehicleId,"SELLER_REPLY_VEHICLE_REQUIRED");
  const inputSellerId=required(input.sellerId,"SELLER_REPLY_SELLER_REQUIRED");
  if(inputSellerId!==sellerId) throw new Error("SELLER_REPLY_VERIFICATION_MISMATCH");
  const question=questions.find(q=>q.questionId===questionId);
  if(!question||question.status!=="published") throw new Error("SELLER_REPLY_QUESTION_NOT_PUBLIC");
  if(question.vehicleId!==vehicleId) throw new Error("SELLER_REPLY_VEHICLE_MISMATCH");
  if(current.some(x=>x.replyId===replyId)) throw new Error("SELLER_REPLY_ID_DUPLICATE");
  const body=required(input.body.replace(/\s+/g," "),"SELLER_REPLY_BODY_REQUIRED");
  if(body.length>2000) throw new Error("SELLER_REPLY_BODY_TOO_LONG");
  const createdAt=iso(input.createdAt,"SELLER_REPLY_TIME_INVALID");
  const media=normalizeAnswerMedia(input.media);
  const next:SellerVerifiedReply=Object.freeze({...input,replyId,questionId,vehicleId,sellerId:inputSellerId,body,createdAt,verifiedSeller:true,media});
  return Object.freeze([...current,next].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.replyId.localeCompare(b.replyId)));
}

export function reviseSellerReplyContent(
  current:SellerVerifiedReply,
  patch:Readonly<{body:string;media:readonly SellerAnswerMedia[]}>,
):SellerVerifiedReply {
  const body=required(patch.body.replace(/\s+/g," "),"SELLER_REPLY_BODY_REQUIRED");
  if(body.length>2000) throw new Error("SELLER_REPLY_BODY_TOO_LONG");
  return Object.freeze({...current,body,media:normalizeAnswerMedia(patch.media),createdAt:current.createdAt});
}

export function assertQaTimestampImmutable(
  before:Readonly<{createdAt:string}>,
  after:Readonly<{createdAt:string}>,
):true {
  if(iso(before.createdAt,"QA_TIMESTAMP_BEFORE_INVALID")!==iso(after.createdAt,"QA_TIMESTAMP_AFTER_INVALID")) {
    throw new Error("QA_TIMESTAMP_IMMUTABLE");
  }
  return true;
}

export function detectQuestionAbuse(
  bodyInput:string,
  blockedTerms:readonly string[]=[],
):Readonly<{allowed:boolean;reasons:readonly string[]}> {
  const body=required(bodyInput.replace(/\s+/g," "),"VEHICLE_QA_BODY_REQUIRED");
  const lower=body.toLowerCase();
  const reasons:string[]=[];
  const links=(body.match(/https?:\/\//gi)??[]).length;
  if(links>2) reasons.push("too-many-links");
  if(/(.)\1{9,}/u.test(body)) reasons.push("repeated-character-spam");
  for(const termInput of blockedTerms){
    const term=required(termInput,"VEHICLE_QA_BLOCKED_TERM_REQUIRED").toLowerCase();
    if(lower.includes(term)) reasons.push("blocked-term:"+term);
  }
  return Object.freeze({allowed:reasons.length===0,reasons:Object.freeze([...new Set(reasons)].sort())});
}

export function applyQuestionModeration(
  question:QuestionRef,
  recordInput:QuestionModerationRecord,
):Readonly<{question:QuestionRef;record:QuestionModerationRecord}> {
  if(recordInput.questionId!==question.questionId) throw new Error("VEHICLE_QA_MODERATION_QUESTION_MISMATCH");
  const record=Object.freeze({
    ...recordInput,
    moderationId:required(recordInput.moderationId,"VEHICLE_QA_MODERATION_ID_REQUIRED"),
    moderatorId:required(recordInput.moderatorId,"VEHICLE_QA_MODERATOR_REQUIRED"),
    reason:required(recordInput.reason,"VEHICLE_QA_MODERATION_REASON_REQUIRED"),
    occurredAt:iso(recordInput.occurredAt,"VEHICLE_QA_MODERATION_TIME_INVALID"),
  });
  const status=record.action==="hide"?"hidden":"published";
  const moderated=Object.freeze({...question,status});
  assertQaTimestampImmutable(question,moderated);
  return Object.freeze({question:moderated,record});
}

export function updateSellerLiveAuctionPresence(
  current:SellerLiveAuctionPresence|null,
  input:SellerLiveAuctionPresence,
):SellerLiveAuctionPresence {
  const next=Object.freeze({
    ...input,
    sellerId:required(input.sellerId,"SELLER_PRESENCE_SELLER_REQUIRED"),
    auctionId:required(input.auctionId,"SELLER_PRESENCE_AUCTION_REQUIRED"),
    connectionId:required(input.connectionId,"SELLER_PRESENCE_CONNECTION_REQUIRED"),
    sequence:nonNegativeInt(input.sequence,"SELLER_PRESENCE_SEQUENCE_INVALID"),
    observedAt:iso(input.observedAt,"SELLER_PRESENCE_TIME_INVALID"),
  });
  if(current){
    if(current.sellerId!==next.sellerId||current.auctionId!==next.auctionId) throw new Error("SELLER_PRESENCE_SCOPE_MISMATCH");
    if(next.sequence<=current.sequence) throw new Error("SELLER_PRESENCE_STALE_SEQUENCE");
    if(Date.parse(next.observedAt)<Date.parse(current.observedAt)) throw new Error("SELLER_PRESENCE_TIME_REGRESSION");
  }
  return next;
}

export function createViewingRequest(input:ViewingRequest):ViewingRequest {
  if(input.status!=="requested") throw new Error("VIEWING_REQUEST_INITIAL_STATUS_INVALID");
  return Object.freeze({
    ...input,
    requestId:required(input.requestId,"VIEWING_REQUEST_ID_REQUIRED"),
    listingId:required(input.listingId,"VIEWING_REQUEST_LISTING_REQUIRED"),
    vehicleId:required(input.vehicleId,"VIEWING_REQUEST_VEHICLE_REQUIRED"),
    buyerId:required(input.buyerId,"VIEWING_REQUEST_BUYER_REQUIRED"),
    sellerId:required(input.sellerId,"VIEWING_REQUEST_SELLER_REQUIRED"),
    requestedAt:iso(input.requestedAt,"VIEWING_REQUEST_TIME_INVALID"),
    scheduledFor:input.scheduledFor===null?null:iso(input.scheduledFor,"VIEWING_REQUEST_SCHEDULE_INVALID"),
    updatedAt:iso(input.updatedAt,"VIEWING_REQUEST_UPDATED_INVALID"),
  });
}

export function transitionViewingRequest(
  current:ViewingRequest,
  nextStatus:ViewingRequestStatus,
  occurredAtInput:string,
  scheduledForInput:string|null=current.scheduledFor,
):ViewingRequest {
  const allowed:Record<ViewingRequestStatus,readonly ViewingRequestStatus[]>={
    requested:["accepted","declined","cancelled"],
    accepted:["completed","cancelled"],
    declined:[],
    cancelled:[],
    completed:[],
  };
  if(!allowed[current.status].includes(nextStatus)) throw new Error("VIEWING_REQUEST_TRANSITION_INVALID");
  const updatedAt=iso(occurredAtInput,"VIEWING_REQUEST_UPDATED_INVALID");
  if(Date.parse(updatedAt)<Date.parse(current.updatedAt)) throw new Error("VIEWING_REQUEST_TIME_REGRESSION");
  const scheduledFor=scheduledForInput===null?null:iso(scheduledForInput,"VIEWING_REQUEST_SCHEDULE_INVALID");
  if(nextStatus==="accepted"&&!scheduledFor) throw new Error("VIEWING_REQUEST_SCHEDULE_REQUIRED");
  return Object.freeze({...current,status:nextStatus,updatedAt,scheduledFor});
}

export function normalizeReserveState(input:ReserveState):ReserveState {
  return Object.freeze({
    ...input,
    listingId:required(input.listingId,"RESERVE_LISTING_REQUIRED"),
    sellerId:required(input.sellerId,"RESERVE_SELLER_REQUIRED"),
    reserveCents:positiveInt(input.reserveCents,"RESERVE_AMOUNT_INVALID"),
    revision:nonNegativeInt(input.revision,"RESERVE_REVISION_INVALID"),
    updatedAt:iso(input.updatedAt,"RESERVE_TIME_INVALID"),
    appliedMutationIds:Object.freeze([...new Set(input.appliedMutationIds.map(x=>required(x,"RESERVE_MUTATION_ID_REQUIRED")))].slice(-256)),
  });
}

export function lowerListingReserve(currentInput:ReserveState,input:ReserveLoweringInput):ReserveState {
  const current=normalizeReserveState(currentInput);
  const sellerId=required(input.sellerId,"RESERVE_SELLER_REQUIRED");
  const mutationId=required(input.mutationId,"RESERVE_MUTATION_ID_REQUIRED");
  if(sellerId!==current.sellerId) throw new Error("RESERVE_CROSS_SELLER");
  if(current.appliedMutationIds.includes(mutationId)) return current;
  if(input.expectedRevision!==current.revision) throw new Error("RESERVE_REVISION_CONFLICT");
  const nextAmount=positiveInt(input.newReserveCents,"RESERVE_AMOUNT_INVALID");
  if(nextAmount>=current.reserveCents) throw new Error("RESERVE_LOWER_ONLY");
  const occurredAt=iso(input.occurredAt,"RESERVE_TIME_INVALID");
  if(Date.parse(occurredAt)<Date.parse(current.updatedAt)) throw new Error("RESERVE_TIME_REGRESSION");
  return normalizeReserveState({
    ...current,
    reserveCents:nextAmount,
    revision:current.revision+1,
    updatedAt:occurredAt,
    appliedMutationIds:[...current.appliedMutationIds,mutationId],
  });
}

export function openReserveNotMetFollowUp(input:ReserveNotMetFollowUp):ReserveNotMetFollowUp {
  const reserveCents=positiveInt(input.reserveCents,"RESERVE_FOLLOWUP_RESERVE_INVALID");
  const highestBidCents=nonNegativeInt(input.highestBidCents,"RESERVE_FOLLOWUP_BID_INVALID");
  if(highestBidCents>=reserveCents) throw new Error("RESERVE_FOLLOWUP_NOT_REQUIRED");
  if(input.status!=="pending") throw new Error("RESERVE_FOLLOWUP_INITIAL_STATUS_INVALID");
  const openedAt=iso(input.openedAt,"RESERVE_FOLLOWUP_OPENED_INVALID");
  const updatedAt=iso(input.updatedAt,"RESERVE_FOLLOWUP_UPDATED_INVALID");
  return Object.freeze({
    ...input,
    followUpId:required(input.followUpId,"RESERVE_FOLLOWUP_ID_REQUIRED"),
    listingId:required(input.listingId,"RESERVE_FOLLOWUP_LISTING_REQUIRED"),
    sellerId:required(input.sellerId,"RESERVE_FOLLOWUP_SELLER_REQUIRED"),
    reserveCents,
    highestBidCents,
    openedAt,
    updatedAt,
  });
}

export function resolveReserveNotMetFollowUp(
  current:ReserveNotMetFollowUp,
  status:Exclude<ReserveNotMetFollowUpStatus,"pending">,
  occurredAtInput:string,
):ReserveNotMetFollowUp {
  if(current.status!=="pending") throw new Error("RESERVE_FOLLOWUP_ALREADY_RESOLVED");
  const updatedAt=iso(occurredAtInput,"RESERVE_FOLLOWUP_UPDATED_INVALID");
  if(Date.parse(updatedAt)<Date.parse(current.updatedAt)) throw new Error("RESERVE_FOLLOWUP_TIME_REGRESSION");
  return Object.freeze({...current,status,updatedAt});
}

export function appendListingChange(
  current:readonly ListingChange[],
  input:ListingChange,
):readonly ListingChange[] {
  const changeId=required(input.changeId,"LISTING_CHANGE_ID_REQUIRED");
  const listingId=required(input.listingId,"LISTING_CHANGE_LISTING_REQUIRED");
  const actorId=required(input.actorId,"LISTING_CHANGE_ACTOR_REQUIRED");
  const field=required(input.field,"LISTING_CHANGE_FIELD_REQUIRED");
  const sequence=positiveInt(input.sequence,"LISTING_CHANGE_SEQUENCE_INVALID");
  const changedAt=iso(input.changedAt,"LISTING_CHANGE_TIME_INVALID");
  if(current.some(x=>x.changeId===changeId)) throw new Error("LISTING_CHANGE_ID_DUPLICATE");
  const scoped=current.filter(x=>x.listingId===listingId);
  const maxSequence=scoped.reduce((max,x)=>Math.max(max,x.sequence),0);
  if(sequence!==maxSequence+1) throw new Error("LISTING_CHANGE_SEQUENCE_GAP");
  if(scoped.length&&Date.parse(changedAt)<Date.parse(scoped[scoped.length-1].changedAt)) throw new Error("LISTING_CHANGE_TIME_REGRESSION");
  const next=Object.freeze({...input,changeId,listingId,actorId,field,sequence,changedAt});
  return Object.freeze([...current,next]);
}

export function publicationStateAfterListingChange(
  currentState:ListingPublicationState,
  change:ListingChange,
):ListingPublicationState {
  if(currentState==="published"&&change.critical) return "pending-review";
  return currentState;
}

export function republishAfterReview(
  currentState:ListingPublicationState,
  approved:boolean,
):ListingPublicationState {
  if(currentState!=="pending-review") throw new Error("LISTING_REVIEW_NOT_PENDING");
  return approved?"published":"draft";
}

export function createSellerResponseNotification(
  current:readonly SellerResponseNotification[],
  reply:SellerVerifiedReply,
  question:QuestionRef,
  channel:"in-app"|"email",
  createdAtInput:string,
):readonly SellerResponseNotification[] {
  if(reply.questionId!==question.questionId) throw new Error("SELLER_NOTIFICATION_QUESTION_MISMATCH");
  const createdAt=iso(createdAtInput,"SELLER_NOTIFICATION_TIME_INVALID");
  const dedupeKey=`seller-reply:${reply.replyId}:${channel}`;
  if(current.some(x=>x.dedupeKey===dedupeKey)) return current;
  const notification=Object.freeze({
    notificationId:`notif-${reply.replyId}-${channel}`,
    replyId:reply.replyId,
    recipientUserId:required(question.askerUserId,"SELLER_NOTIFICATION_RECIPIENT_REQUIRED"),
    channel,
    createdAt,
    dedupeKey,
  });
  return Object.freeze([...current,notification]);
}
