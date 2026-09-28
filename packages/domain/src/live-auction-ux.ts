export type LiveAuctionConnectionState = "syncing" | "connected" | "reconnecting" | "stale" | "offline";
export type LiveAuctionNetworkQuality = "excellent" | "good" | "degraded" | "offline";
export type LiveAuctionLotState = "upcoming" | "live" | "sold" | "unsold" | "cancelled";
export type BidConfirmationState = "idle" | "armed" | "submitting" | "accepted" | "rejected" | "outbid";
export type LiveAnnouncementKind = "connection" | "bid" | "outbid" | "extension" | "lot-change";

export type LiveAuctionLotSnapshot = Readonly<{
  auctionId: string;
  lotId: string;
  title: string;
  queueOrder: number;
  state: LiveAuctionLotState;
  currentBidCents: number;
  sequence: number;
  updatedAt: string;
  endsAt: string | null;
}>;

export type BidderFocusMode = Readonly<{
  userId: string;
  auctionId: string;
  focusedLotId: string;
  enabled: boolean;
  distractionGuard: boolean;
}>;

export type MultiLotDashboardItem = Readonly<{
  auctionId: string;
  lotId: string;
  title: string;
  currentBidCents: number;
  lanePosition: number;
  lotsAway: number;
  relation: "current" | "upcoming" | "passed";
  stale: boolean;
}>;

export type CurrentNextLotPanel = Readonly<{
  current: LiveAuctionLotSnapshot | null;
  next: LiveAuctionLotSnapshot | null;
}>;

export type ServerTimeSyncIndicator = Readonly<{
  offsetMs: number;
  rttMs: number;
  quality: "synced" | "degraded";
  alignedNowMs: number;
}>;

export type NetworkQualityIndicator = Readonly<{
  quality: LiveAuctionNetworkQuality;
  rttMs: number | null;
  syncAgeMs: number | null;
}>;

export type ReconnectProgress = Readonly<{
  state: "idle" | "retrying" | "exhausted";
  attempt: number;
  maxAttempts: number;
  progressPct: number;
  nextRetryMs: number | null;
}>;

export type AuthoritativeLiveSnapshot = Readonly<{
  accountId: string;
  auctionId: string;
  deviceId: string;
  tabId: string;
  sequence: number;
  serverNow: string;
  currentLotId: string;
  lots: readonly LiveAuctionLotSnapshot[];
}>;

export type LiveClientReplica = Readonly<{
  accountId: string;
  auctionId: string;
  deviceId: string;
  tabId: string;
  sequence: number;
  updatedAt: string;
  stale: boolean;
  currentLotId: string | null;
}>;

export type BidActionConfirmation = Readonly<{
  state: BidConfirmationState;
  auctionId: string;
  lotId: string;
  amountCents: number;
  reasonCode: string | null;
  reasonText: string | null;
}>;

export type LiveTabLease = Readonly<{
  accountId: string;
  auctionId: string;
  tabId: string;
  leaseSequence: number;
  heartbeatAt: string;
}>;

export type TabConflictResolution = Readonly<{
  ownerTabId: string;
  readOnlyTabIds: readonly string[];
}>;

export type SameAccountDeviceState = Readonly<{
  accountId: string;
  deviceId: string;
  auctionId: string;
  sequence: number;
  currentLotId: string | null;
  stale: boolean;
}>;

function required(value: string, code: string): string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function timestamp(value:string, code:string): number {
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error(code);
  return ms;
}

function nonNegativeInt(value:number, code:string):number{
  if(!Number.isInteger(value)||value<0) throw new Error(code);
  return value;
}

function normalizedLots(lots:readonly LiveAuctionLotSnapshot[], auctionIdInput:string):readonly LiveAuctionLotSnapshot[]{
  const auctionId=required(auctionIdInput,"LIVE_UX_AUCTION_REQUIRED");
  const lotIds=new Set<string>();
  const orders=new Set<number>();
  const rows=lots.map(lot=>{
    const lotAuctionId=required(lot.auctionId,"LIVE_UX_LOT_AUCTION_REQUIRED");
    const lotId=required(lot.lotId,"LIVE_UX_LOT_REQUIRED");
    const title=required(lot.title,"LIVE_UX_LOT_TITLE_REQUIRED");
    if(lotAuctionId!==auctionId) throw new Error("LIVE_UX_CROSS_AUCTION_LOT");
    if(lotIds.has(lotId)) throw new Error("LIVE_UX_DUPLICATE_LOT");
    if(!Number.isInteger(lot.queueOrder)||lot.queueOrder<1) throw new Error("LIVE_UX_QUEUE_ORDER_INVALID");
    if(orders.has(lot.queueOrder)) throw new Error("LIVE_UX_DUPLICATE_QUEUE_ORDER");
    if(!Number.isInteger(lot.currentBidCents)||lot.currentBidCents<0) throw new Error("LIVE_UX_BID_INVALID");
    nonNegativeInt(lot.sequence,"LIVE_UX_SEQUENCE_INVALID");
    timestamp(lot.updatedAt,"LIVE_UX_UPDATED_AT_INVALID");
    if(lot.endsAt!==null) timestamp(lot.endsAt,"LIVE_UX_ENDS_AT_INVALID");
    lotIds.add(lotId);
    orders.add(lot.queueOrder);
    return Object.freeze({...lot,auctionId:lotAuctionId,lotId,title});
  }).sort((a,b)=>a.queueOrder-b.queueOrder||a.lotId.localeCompare(b.lotId));
  if(rows.filter(x=>x.state==="live").length>1) throw new Error("LIVE_UX_MULTIPLE_CURRENT_LOTS");
  return Object.freeze(rows);
}

export function buildBidderFocusMode(
  userIdInput:string,
  auctionIdInput:string,
  focusedLotIdInput:string,
  enabled=true,
):BidderFocusMode{
  return Object.freeze({
    userId:required(userIdInput,"FOCUS_USER_REQUIRED"),
    auctionId:required(auctionIdInput,"FOCUS_AUCTION_REQUIRED"),
    focusedLotId:required(focusedLotIdInput,"FOCUS_LOT_REQUIRED"),
    enabled:Boolean(enabled),
    distractionGuard:Boolean(enabled),
  });
}

export function buildMultiLotDashboard(
  lotsInput:readonly LiveAuctionLotSnapshot[],
  auctionIdInput:string,
  currentLotIdInput:string,
  staleLotIds:readonly string[]=[],
):readonly MultiLotDashboardItem[]{
  const auctionId=required(auctionIdInput,"DASHBOARD_AUCTION_REQUIRED");
  const currentLotId=required(currentLotIdInput,"DASHBOARD_CURRENT_LOT_REQUIRED");
  const lots=normalizedLots(lotsInput,auctionId);
  const current=lots.find(x=>x.lotId===currentLotId);
  if(!current) throw new Error("DASHBOARD_CURRENT_LOT_NOT_FOUND");
  const stale=new Set(staleLotIds);
  return Object.freeze(lots.map(lot=>{
    const passed=lot.state==="sold"||lot.state==="unsold"||lot.state==="cancelled"||lot.queueOrder<current.queueOrder;
    const relation:MultiLotDashboardItem["relation"]=lot.lotId===currentLotId?"current":passed?"passed":"upcoming";
    return Object.freeze({
      auctionId,
      lotId:lot.lotId,
      title:lot.title,
      currentBidCents:lot.currentBidCents,
      lanePosition:lot.queueOrder,
      lotsAway:relation==="upcoming"?Math.max(0,lot.queueOrder-current.queueOrder):0,
      relation,
      stale:stale.has(lot.lotId),
    });
  }));
}

export function buildCurrentNextLotPanel(
  lotsInput:readonly LiveAuctionLotSnapshot[],
  auctionIdInput:string,
  currentLotIdInput:string,
):CurrentNextLotPanel{
  const auctionId=required(auctionIdInput,"PANEL_AUCTION_REQUIRED");
  const currentLotId=required(currentLotIdInput,"PANEL_CURRENT_LOT_REQUIRED");
  const lots=normalizedLots(lotsInput,auctionId);
  const index=lots.findIndex(x=>x.lotId===currentLotId);
  if(index===-1) throw new Error("PANEL_CURRENT_LOT_NOT_FOUND");
  return Object.freeze({current:lots[index]??null,next:lots[index+1]??null});
}

export function buildServerTimeSyncIndicator(
  sentAtMs:number,
  receivedAtMs:number,
  serverNowMs:number,
):ServerTimeSyncIndicator{
  if(!Number.isFinite(sentAtMs)||!Number.isFinite(receivedAtMs)||!Number.isFinite(serverNowMs)) throw new Error("TIME_SYNC_VALUE_INVALID");
  if(receivedAtMs<sentAtMs) throw new Error("TIME_SYNC_INTERVAL_INVALID");
  const rttMs=receivedAtMs-sentAtMs;
  const midpoint=sentAtMs+rttMs/2;
  const offsetMs=serverNowMs-midpoint;
  return Object.freeze({
    offsetMs,
    rttMs,
    quality:rttMs<=750?"synced":"degraded",
    alignedNowMs:receivedAtMs+offsetMs,
  });
}

export function buildNetworkQualityIndicator(input:Readonly<{
  online:boolean;
  rttMs:number|null;
  lastServerSyncAtMs:number|null;
  nowMs:number;
  staleAfterMs?:number;
}>):NetworkQualityIndicator{
  const staleAfterMs=input.staleAfterMs??4500;
  if(!Number.isFinite(input.nowMs)||!Number.isFinite(staleAfterMs)||staleAfterMs<=0) throw new Error("NETWORK_CLOCK_INVALID");
  if(!input.online) return Object.freeze({quality:"offline",rttMs:null,syncAgeMs:input.lastServerSyncAtMs===null?null:Math.max(0,input.nowMs-input.lastServerSyncAtMs)});
  const rtt=input.rttMs;
  if(rtt!==null&&(!Number.isFinite(rtt)||rtt<0)) throw new Error("NETWORK_RTT_INVALID");
  const age=input.lastServerSyncAtMs===null?null:Math.max(0,input.nowMs-input.lastServerSyncAtMs);
  const quality:LiveAuctionNetworkQuality=
    age!==null&&age>=staleAfterMs?"degraded":
    rtt===null?"good":
    rtt<=250?"excellent":
    rtt<=750?"good":"degraded";
  return Object.freeze({quality,rttMs:rtt,syncAgeMs:age});
}

export function connectionLossBanner(state:LiveAuctionConnectionState):Readonly<{visible:boolean;tone:"info"|"warning"|"critical";message:string}>{
  if(state==="connected") return Object.freeze({visible:false,tone:"info",message:""});
  if(state==="syncing") return Object.freeze({visible:true,tone:"info",message:"Synchronizing authoritative auction state."});
  if(state==="reconnecting") return Object.freeze({visible:true,tone:"warning",message:"Connection lost. Reconnecting and pausing unsafe bid actions."});
  if(state==="stale") return Object.freeze({visible:true,tone:"critical",message:"Auction state is stale. Authoritative resync is required before bidding."});
  return Object.freeze({visible:true,tone:"critical",message:"Device is offline. Bidding is disabled until connection returns."});
}

export function buildReconnectProgress(attempt:number,maxAttempts:number,baseDelayMs=500):ReconnectProgress{
  if(!Number.isInteger(attempt)||attempt<0) throw new Error("RECONNECT_ATTEMPT_INVALID");
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20) throw new Error("RECONNECT_MAX_INVALID");
  if(!Number.isFinite(baseDelayMs)||baseDelayMs<100||baseDelayMs>60_000) throw new Error("RECONNECT_DELAY_INVALID");
  if(attempt===0) return Object.freeze({state:"idle",attempt,maxAttempts,progressPct:0,nextRetryMs:null});
  if(attempt>=maxAttempts) return Object.freeze({state:"exhausted",attempt,maxAttempts,progressPct:100,nextRetryMs:null});
  return Object.freeze({
    state:"retrying",
    attempt,
    maxAttempts,
    progressPct:Math.min(99,Math.round(attempt/maxAttempts*100)),
    nextRetryMs:Math.min(30_000,baseDelayMs*2**Math.max(0,attempt-1)),
  });
}

export function authoritativeResync(
  current:LiveClientReplica,
  snapshot:AuthoritativeLiveSnapshot,
):LiveClientReplica{
  const accountId=required(current.accountId,"RESYNC_ACCOUNT_REQUIRED");
  const auctionId=required(current.auctionId,"RESYNC_AUCTION_REQUIRED");
  if(required(snapshot.accountId,"RESYNC_SNAPSHOT_ACCOUNT_REQUIRED")!==accountId) throw new Error("RESYNC_CROSS_ACCOUNT");
  if(required(snapshot.auctionId,"RESYNC_SNAPSHOT_AUCTION_REQUIRED")!==auctionId) throw new Error("RESYNC_CROSS_AUCTION");
  nonNegativeInt(snapshot.sequence,"RESYNC_SEQUENCE_INVALID");
  if(snapshot.sequence<current.sequence) throw new Error("RESYNC_SEQUENCE_REGRESSION");
  timestamp(snapshot.serverNow,"RESYNC_SERVER_TIME_INVALID");
  const lots=normalizedLots(snapshot.lots,auctionId);
  if(!lots.some(x=>x.lotId===snapshot.currentLotId)) throw new Error("RESYNC_CURRENT_LOT_MISSING");
  return Object.freeze({
    accountId,
    auctionId,
    deviceId:required(current.deviceId,"RESYNC_DEVICE_REQUIRED"),
    tabId:required(current.tabId,"RESYNC_TAB_REQUIRED"),
    sequence:snapshot.sequence,
    updatedAt:new Date(timestamp(snapshot.serverNow,"RESYNC_SERVER_TIME_INVALID")).toISOString(),
    stale:false,
    currentLotId:snapshot.currentLotId,
  });
}

export function staleStateDecision(
  replica:LiveClientReplica,
  nowMs:number,
  staleAfterMs=4500,
):Readonly<{stale:boolean;hardRefreshRequired:boolean;ageMs:number}>{
  const updatedAt=timestamp(replica.updatedAt,"STALE_UPDATED_AT_INVALID");
  if(!Number.isFinite(nowMs)||nowMs<updatedAt) throw new Error("STALE_NOW_INVALID");
  if(!Number.isFinite(staleAfterMs)||staleAfterMs<1000) throw new Error("STALE_THRESHOLD_INVALID");
  const ageMs=nowMs-updatedAt;
  const stale=replica.stale||ageMs>=staleAfterMs;
  return Object.freeze({stale,hardRefreshRequired:stale&&ageMs>=staleAfterMs*2,ageMs});
}

export function armBidAction(input:Readonly<{
  auctionId:string;
  lotId:string;
  amountCents:number;
  connectionState:LiveAuctionConnectionState;
  readOnly:boolean;
}>):BidActionConfirmation{
  const auctionId=required(input.auctionId,"BID_CONFIRM_AUCTION_REQUIRED");
  const lotId=required(input.lotId,"BID_CONFIRM_LOT_REQUIRED");
  if(!Number.isInteger(input.amountCents)||input.amountCents<=0) throw new Error("BID_CONFIRM_AMOUNT_INVALID");
  if(input.readOnly) throw new Error("BID_CONFIRM_READ_ONLY");
  if(input.connectionState!=="connected") throw new Error("BID_CONFIRM_CONNECTION_UNSAFE");
  return Object.freeze({state:"armed",auctionId,lotId,amountCents:input.amountCents,reasonCode:null,reasonText:null});
}

export function submitArmedBid(input:BidActionConfirmation):BidActionConfirmation{
  if(input.state!=="armed") throw new Error("BID_SUBMIT_NOT_ARMED");
  return Object.freeze({...input,state:"submitting"});
}

export function resolveBidAction(
  input:BidActionConfirmation,
  outcome:"accepted"|"leading"|"rejected"|"outbid",
  reasonCode:string|null,
):BidActionConfirmation{
  if(input.state!=="submitting") throw new Error("BID_RESULT_NOT_SUBMITTING");
  const code=reasonCode===null?null:required(reasonCode,"BID_REASON_INVALID");
  if(outcome==="rejected"&&code===null) throw new Error("BID_REJECT_REASON_REQUIRED");
  const reasonText=
    outcome==="accepted"?"Bid accepted by authoritative auction state.":
    outcome==="leading"?"Bid accepted; you are currently leading.":
    outcome==="outbid"?"Another accepted bid is currently higher.":
    "Bid rejected: "+code;
  return Object.freeze({...input,state:outcome==="leading"?"accepted":outcome,reasonCode:code,reasonText});
}

export function applyOutbidRealtime(
  input:BidActionConfirmation,
  authoritativeBidCents:number,
):BidActionConfirmation{
  if(!Number.isInteger(authoritativeBidCents)||authoritativeBidCents<=input.amountCents) throw new Error("OUTBID_AMOUNT_NOT_HIGHER");
  return Object.freeze({...input,state:"outbid",reasonCode:"higher-authoritative-bid",reasonText:"Another accepted bid is currently higher."});
}

export function detectLateExtension(input:Readonly<{
  previousEndsAtMs:number;
  nextEndsAtMs:number;
  bidOccurredAtMs:number;
  lateWindowMs?:number;
}>):Readonly<{extended:boolean;extensionMs:number;late:boolean}>{
  const lateWindowMs=input.lateWindowMs??3000;
  for(const value of [input.previousEndsAtMs,input.nextEndsAtMs,input.bidOccurredAtMs,lateWindowMs]){
    if(!Number.isFinite(value)) throw new Error("EXTENSION_TIME_INVALID");
  }
  if(input.nextEndsAtMs<input.previousEndsAtMs) throw new Error("EXTENSION_END_REGRESSION");
  const extensionMs=input.nextEndsAtMs-input.previousEndsAtMs;
  const late=input.previousEndsAtMs-input.bidOccurredAtMs<=lateWindowMs&&input.bidOccurredAtMs<=input.previousEndsAtMs;
  return Object.freeze({extended:extensionMs>0,extensionMs,late:extensionMs>0&&late});
}

export function resolveMultiTabConflict(
  leasesInput:readonly LiveTabLease[],
  nowMs:number,
  leaseTtlMs=5000,
):TabConflictResolution{
  if(!Number.isFinite(nowMs)) throw new Error("TAB_NOW_INVALID");
  if(!Number.isFinite(leaseTtlMs)||leaseTtlMs<1000) throw new Error("TAB_TTL_INVALID");
  if(leasesInput.length===0) throw new Error("TAB_LEASE_REQUIRED");
  const account=required(leasesInput[0].accountId,"TAB_ACCOUNT_REQUIRED");
  const auction=required(leasesInput[0].auctionId,"TAB_AUCTION_REQUIRED");
  const active=leasesInput.filter(lease=>{
    if(required(lease.accountId,"TAB_ACCOUNT_REQUIRED")!==account) throw new Error("TAB_CROSS_ACCOUNT");
    if(required(lease.auctionId,"TAB_AUCTION_REQUIRED")!==auction) throw new Error("TAB_CROSS_AUCTION");
    required(lease.tabId,"TAB_ID_REQUIRED");
    nonNegativeInt(lease.leaseSequence,"TAB_SEQUENCE_INVALID");
    const heartbeat=timestamp(lease.heartbeatAt,"TAB_HEARTBEAT_INVALID");
    return nowMs-heartbeat<=leaseTtlMs;
  });
  if(active.length===0) throw new Error("TAB_NO_ACTIVE_LEASE");
  const sorted=[...active].sort((a,b)=>b.leaseSequence-a.leaseSequence||timestamp(b.heartbeatAt,"TAB_HEARTBEAT_INVALID")-timestamp(a.heartbeatAt,"TAB_HEARTBEAT_INVALID")||a.tabId.localeCompare(b.tabId));
  return Object.freeze({ownerTabId:sorted[0].tabId,readOnlyTabIds:Object.freeze(sorted.slice(1).map(x=>x.tabId).sort())});
}

export function keyboardBidCommand(input:Readonly<{
  key:string;
  focusEnabled:boolean;
  bidState:BidConfirmationState;
  readOnly:boolean;
}>):"arm"|"submit"|"cancel"|"ignore"{
  if(!input.focusEnabled||input.readOnly) return "ignore";
  const key=input.key.toLowerCase();
  if(key==="escape"&&input.bidState==="armed") return "cancel";
  if((key==="b"||key===" ")&&input.bidState==="idle") return "arm";
  if(key==="enter"&&input.bidState==="armed") return "submit";
  return "ignore";
}

export function mobileLiveRoomLayout(viewportWidth:number):Readonly<{mode:"mobile"|"tablet"|"desktop";stickyBidBar:boolean;dashboardColumns:number}>{
  if(!Number.isFinite(viewportWidth)||viewportWidth<240) throw new Error("MOBILE_VIEWPORT_INVALID");
  if(viewportWidth<768) return Object.freeze({mode:"mobile",stickyBidBar:true,dashboardColumns:1});
  if(viewportWidth<1180) return Object.freeze({mode:"tablet",stickyBidBar:true,dashboardColumns:2});
  return Object.freeze({mode:"desktop",stickyBidBar:false,dashboardColumns:4});
}

export function accessibleLiveAnnouncement(kind:LiveAnnouncementKind, detail:string):string{
  const safe=required(detail,"ANNOUNCEMENT_DETAIL_REQUIRED");
  if(kind==="connection") return "Connection status: "+safe;
  if(kind==="bid") return "Bid status: "+safe;
  if(kind==="outbid") return "Outbid alert: "+safe;
  if(kind==="extension") return "Auction time extended: "+safe;
  return "Current lot changed: "+safe;
}

export function reconcileSameAccountDevices(
  devicesInput:readonly SameAccountDeviceState[],
  snapshot:AuthoritativeLiveSnapshot,
):readonly SameAccountDeviceState[]{
  const accountId=required(snapshot.accountId,"DEVICE_SNAPSHOT_ACCOUNT_REQUIRED");
  const auctionId=required(snapshot.auctionId,"DEVICE_SNAPSHOT_AUCTION_REQUIRED");
  nonNegativeInt(snapshot.sequence,"DEVICE_SNAPSHOT_SEQUENCE_INVALID");
  normalizedLots(snapshot.lots,auctionId);
  return Object.freeze(devicesInput.map(device=>{
    if(required(device.accountId,"DEVICE_ACCOUNT_REQUIRED")!==accountId) throw new Error("DEVICE_CROSS_ACCOUNT");
    if(required(device.auctionId,"DEVICE_AUCTION_REQUIRED")!==auctionId) throw new Error("DEVICE_CROSS_AUCTION");
    required(device.deviceId,"DEVICE_ID_REQUIRED");
    if(device.sequence>snapshot.sequence) throw new Error("DEVICE_SEQUENCE_AHEAD_OF_AUTHORITY");
    return Object.freeze({...device,sequence:snapshot.sequence,currentLotId:snapshot.currentLotId,stale:false});
  }).sort((a,b)=>a.deviceId.localeCompare(b.deviceId)));
}
