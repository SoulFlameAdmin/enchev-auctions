import {
  assertFunctionAuthorized,
  type FunctionAuthorizationContext,
} from "./function-authorization.js";
import {
  assertAuthenticatedSession,
  type SessionSecurityPolicy,
  type SessionSecurityState,
} from "./session-security.js";

export type BidAbusePolicy = Readonly<{
  actorAuctionLimit:number;
  actorAuctionWindowMs:number;
  actorFanoutAuctionLimit:number;
  actorFanoutWindowMs:number;
  sourceDistinctActorLimit:number;
  sourceActorWindowMs:number;
  regularCadenceSamples:number;
  regularCadenceToleranceMs:number;
  challengeTtlMs:number;
  maxHistory:number;
}>;

export type BidAbuseAttempt = Readonly<{
  actorId:string;
  trustedSourceKey:string;
  auctionId:string;
  atMs:number;
}>;

export type BidAbuseChallenge = Readonly<{
  challengeId:string;
  actorId:string;
  sessionId:string;
  securityVersion:number;
  auctionId:string;
  issuedAtMs:number;
  expiresAtMs:number;
  consumedAtMs:number|null;
}>;

export type BidAbuseState = Readonly<{
  attempts:readonly BidAbuseAttempt[];
  challenges:readonly BidAbuseChallenge[];
  lastObservedAtMs:number|null;
}>;

export type BidAbuseDecision = Readonly<{
  allowed:boolean;
  challengeRequired:boolean;
  reason:"actor-auction-velocity"|"actor-fanout"|"source-multi-account"|"regular-cadence"|null;
  state:BidAbuseState;
}>;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}
function positiveInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}
function nonNegativeInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}
function normalizePolicy(policy:BidAbusePolicy):BidAbusePolicy{
  const normalized=Object.freeze({
    actorAuctionLimit:positiveInt(policy.actorAuctionLimit,"BID_ABUSE_ACTOR_AUCTION_LIMIT_INVALID"),
    actorAuctionWindowMs:positiveInt(policy.actorAuctionWindowMs,"BID_ABUSE_ACTOR_AUCTION_WINDOW_INVALID"),
    actorFanoutAuctionLimit:positiveInt(policy.actorFanoutAuctionLimit,"BID_ABUSE_FANOUT_LIMIT_INVALID"),
    actorFanoutWindowMs:positiveInt(policy.actorFanoutWindowMs,"BID_ABUSE_FANOUT_WINDOW_INVALID"),
    sourceDistinctActorLimit:positiveInt(policy.sourceDistinctActorLimit,"BID_ABUSE_SOURCE_ACTOR_LIMIT_INVALID"),
    sourceActorWindowMs:positiveInt(policy.sourceActorWindowMs,"BID_ABUSE_SOURCE_ACTOR_WINDOW_INVALID"),
    regularCadenceSamples:positiveInt(policy.regularCadenceSamples,"BID_ABUSE_CADENCE_SAMPLES_INVALID"),
    regularCadenceToleranceMs:nonNegativeInt(policy.regularCadenceToleranceMs,"BID_ABUSE_CADENCE_TOLERANCE_INVALID"),
    challengeTtlMs:positiveInt(policy.challengeTtlMs,"BID_ABUSE_CHALLENGE_TTL_INVALID"),
    maxHistory:positiveInt(policy.maxHistory,"BID_ABUSE_HISTORY_INVALID"),
  });
  if(normalized.regularCadenceSamples<3) throw new Error("BID_ABUSE_CADENCE_SAMPLES_TOO_LOW");
  if(normalized.maxHistory<normalized.actorAuctionLimit) throw new Error("BID_ABUSE_HISTORY_TOO_LOW");
  return normalized;
}

export function validateBidAbusePolicy(policy:BidAbusePolicy):BidAbusePolicy{
  return normalizePolicy(policy);
}

export function emptyBidAbuseState():BidAbuseState{
  return Object.freeze({attempts:Object.freeze([]),challenges:Object.freeze([]),lastObservedAtMs:null});
}

function pruneState(state:BidAbuseState,nowMs:number,policy:BidAbusePolicy):BidAbuseState{
  const maxWindow=Math.max(policy.actorAuctionWindowMs,policy.actorFanoutWindowMs,policy.sourceActorWindowMs);
  const floor=nowMs-maxWindow;
  const attempts=state.attempts.filter(x=>x.atMs>floor&&x.atMs<=nowMs).slice(-policy.maxHistory);
  return Object.freeze({
    attempts:Object.freeze(attempts),
    challenges:state.challenges,
    lastObservedAtMs:nowMs,
  });
}

function regularCadence(
  attempts:readonly BidAbuseAttempt[],
  actorId:string,
  auctionId:string,
  nowMs:number,
  policy:BidAbusePolicy,
):boolean{
  const recent=attempts
    .filter(x=>x.actorId===actorId&&x.auctionId===auctionId)
    .map(x=>x.atMs)
    .slice(-(policy.regularCadenceSamples-1));
  const points=[...recent,nowMs];
  if(points.length<policy.regularCadenceSamples) return false;
  const intervals:number[]=[];
  for(let i=1;i<points.length;i++) intervals.push(points[i]-points[i-1]);
  if(intervals.some(x=>x<=0)) return false;
  const baseline=intervals[0];
  return intervals.every(x=>Math.abs(x-baseline)<=policy.regularCadenceToleranceMs);
}

function normalizeRiskInput(
  state:BidAbuseState,
  input:Readonly<{
    actorId:string;
    trustedSourceKey:string;
    auctionId:string;
    nowMs:number;
    clientClaimedActorId?:string|null;
    clientClaimedSourceKey?:string|null;
    clientClaimedHuman?:boolean|null;
  }>,
):Readonly<{actorId:string;trustedSourceKey:string;auctionId:string;nowMs:number}>{
  if(input.clientClaimedActorId!==undefined&&input.clientClaimedActorId!==null) throw new Error("BID_ABUSE_CLIENT_ACTOR_CLAIM_FORBIDDEN");
  if(input.clientClaimedSourceKey!==undefined&&input.clientClaimedSourceKey!==null) throw new Error("BID_ABUSE_CLIENT_SOURCE_CLAIM_FORBIDDEN");
  if(input.clientClaimedHuman!==undefined&&input.clientClaimedHuman!==null) throw new Error("BID_ABUSE_CLIENT_HUMAN_CLAIM_FORBIDDEN");
  const nowMs=nonNegativeInt(input.nowMs,"BID_ABUSE_NOW_INVALID");
  if(state.lastObservedAtMs!==null&&nowMs<state.lastObservedAtMs) throw new Error("BID_ABUSE_CLOCK_REGRESSION");
  return Object.freeze({
    actorId:required(input.actorId,"BID_ABUSE_ACTOR_REQUIRED"),
    trustedSourceKey:required(input.trustedSourceKey,"BID_ABUSE_SOURCE_REQUIRED"),
    auctionId:required(input.auctionId,"BID_ABUSE_AUCTION_REQUIRED"),
    nowMs,
  });
}

export function assessBidAbuse(
  stateInput:BidAbuseState,
  input:Readonly<{
    actorId:string;
    trustedSourceKey:string;
    auctionId:string;
    nowMs:number;
    clientClaimedActorId?:string|null;
    clientClaimedSourceKey?:string|null;
    clientClaimedHuman?:boolean|null;
  }>,
  policyInput:BidAbusePolicy,
):BidAbuseDecision{
  const policy=normalizePolicy(policyInput);
  const ctx=normalizeRiskInput(stateInput,input);
  const state=pruneState(stateInput,ctx.nowMs,policy);

  const actorAuction=state.attempts.filter(x=>
    x.actorId===ctx.actorId
    && x.auctionId===ctx.auctionId
    && x.atMs>ctx.nowMs-policy.actorAuctionWindowMs
  );
  if(actorAuction.length>=policy.actorAuctionLimit){
    return Object.freeze({allowed:false,challengeRequired:true,reason:"actor-auction-velocity",state});
  }

  const actorFanout=state.attempts.filter(x=>
    x.actorId===ctx.actorId
    && x.atMs>ctx.nowMs-policy.actorFanoutWindowMs
  );
  const actorAuctions=new Set(actorFanout.map(x=>x.auctionId));
  if(!actorAuctions.has(ctx.auctionId)&&actorAuctions.size>=policy.actorFanoutAuctionLimit){
    return Object.freeze({allowed:false,challengeRequired:true,reason:"actor-fanout",state});
  }

  const sourceAttempts=state.attempts.filter(x=>
    x.trustedSourceKey===ctx.trustedSourceKey
    && x.atMs>ctx.nowMs-policy.sourceActorWindowMs
  );
  const sourceActors=new Set(sourceAttempts.map(x=>x.actorId));
  if(!sourceActors.has(ctx.actorId)&&sourceActors.size>=policy.sourceDistinctActorLimit){
    return Object.freeze({allowed:false,challengeRequired:true,reason:"source-multi-account",state});
  }

  if(regularCadence(state.attempts,ctx.actorId,ctx.auctionId,ctx.nowMs,policy)){
    return Object.freeze({allowed:false,challengeRequired:true,reason:"regular-cadence",state});
  }

  return Object.freeze({allowed:true,challengeRequired:false,reason:null,state});
}

export function issueBidAbuseChallenge(
  stateInput:BidAbuseState,
  input:Readonly<{
    challengeId:string;
    actorId:string;
    sessionId:string;
    securityVersion:number;
    auctionId:string;
    issuedAtMs:number;
  }>,
  policyInput:BidAbusePolicy,
):Readonly<{state:BidAbuseState;challenge:BidAbuseChallenge}>{
  const policy=normalizePolicy(policyInput);
  const challengeId=required(input.challengeId,"BID_ABUSE_CHALLENGE_ID_REQUIRED");
  const actorId=required(input.actorId,"BID_ABUSE_ACTOR_REQUIRED");
  const sessionId=required(input.sessionId,"BID_ABUSE_SESSION_REQUIRED");
  const auctionId=required(input.auctionId,"BID_ABUSE_AUCTION_REQUIRED");
  const issuedAtMs=nonNegativeInt(input.issuedAtMs,"BID_ABUSE_CHALLENGE_TIME_INVALID");
  const securityVersion=nonNegativeInt(input.securityVersion,"BID_ABUSE_SECURITY_VERSION_INVALID");
  if(stateInput.challenges.some(x=>x.challengeId===challengeId)) throw new Error("BID_ABUSE_CHALLENGE_ID_COLLISION");
  if(stateInput.lastObservedAtMs!==null&&issuedAtMs<stateInput.lastObservedAtMs) throw new Error("BID_ABUSE_CLOCK_REGRESSION");
  const challenge:BidAbuseChallenge=Object.freeze({
    challengeId,actorId,sessionId,securityVersion,auctionId,issuedAtMs,
    expiresAtMs:issuedAtMs+policy.challengeTtlMs,
    consumedAtMs:null,
  });
  return Object.freeze({
    state:Object.freeze({
      attempts:stateInput.attempts,
      challenges:Object.freeze([...stateInput.challenges,challenge]),
      lastObservedAtMs:issuedAtMs,
    }),
    challenge,
  });
}

function consumeChallenge(
  state:BidAbuseState,
  input:Readonly<{
    challengeId:string;
    actorId:string;
    sessionId:string;
    securityVersion:number;
    auctionId:string;
    nowMs:number;
  }>,
):BidAbuseState{
  const challengeId=required(input.challengeId,"BID_ABUSE_CHALLENGE_REQUIRED");
  const challenge=state.challenges.find(x=>x.challengeId===challengeId);
  if(!challenge) throw new Error("BID_ABUSE_CHALLENGE_NOT_FOUND");
  if(challenge.actorId!==input.actorId) throw new Error("BID_ABUSE_CHALLENGE_ACTOR_MISMATCH");
  if(challenge.sessionId!==input.sessionId) throw new Error("BID_ABUSE_CHALLENGE_SESSION_MISMATCH");
  if(challenge.securityVersion!==input.securityVersion) throw new Error("BID_ABUSE_CHALLENGE_SECURITY_VERSION_MISMATCH");
  if(challenge.auctionId!==input.auctionId) throw new Error("BID_ABUSE_CHALLENGE_AUCTION_MISMATCH");
  if(challenge.consumedAtMs!==null) throw new Error("BID_ABUSE_CHALLENGE_REPLAY");
  if(input.nowMs<challenge.issuedAtMs) throw new Error("BID_ABUSE_CLOCK_REGRESSION");
  if(input.nowMs>=challenge.expiresAtMs) throw new Error("BID_ABUSE_CHALLENGE_EXPIRED");

  const challenges=state.challenges.map(x=>x.challengeId===challengeId
    ? Object.freeze({...x,consumedAtMs:input.nowMs})
    : x);
  return Object.freeze({...state,challenges:Object.freeze(challenges),lastObservedAtMs:input.nowMs});
}

export function authorizeAndRecordBidAttempt(
  stateInput:BidAbuseState,
  input:Readonly<{
    actorContext:FunctionAuthorizationContext;
    sessionState:SessionSecurityState;
    sessionPolicy:SessionSecurityPolicy;
    sessionId:string;
    requiredSecurityVersion:number;
    trustedSourceKey:string;
    auctionId:string;
    nowMs:number;
    challengeId?:string|null;
    clientClaimedActorId?:string|null;
    clientClaimedSourceKey?:string|null;
    clientClaimedHuman?:boolean|null;
  }>,
  policyInput:BidAbusePolicy,
):Readonly<{state:BidAbuseState;challenged:boolean;riskReason:BidAbuseDecision["reason"]}>{
  const policy=normalizePolicy(policyInput);
  assertFunctionAuthorized(input.actorContext,"buyer.submit-bid",{kind:"own",ownerActorId:input.actorContext.actorId});
  const session=assertAuthenticatedSession(input.sessionState,{
    sessionId:input.sessionId,
    userId:input.actorContext.actorId,
    nowMs:input.nowMs,
    requiredSecurityVersion:input.requiredSecurityVersion,
  },input.sessionPolicy);

  const decision=assessBidAbuse(stateInput,{
    actorId:input.actorContext.actorId,
    trustedSourceKey:input.trustedSourceKey,
    auctionId:input.auctionId,
    nowMs:input.nowMs,
    clientClaimedActorId:input.clientClaimedActorId,
    clientClaimedSourceKey:input.clientClaimedSourceKey,
    clientClaimedHuman:input.clientClaimedHuman,
  },policy);

  let state=decision.state;
  let challenged=false;
  if(decision.challengeRequired){
    if(!input.challengeId) throw new Error("BID_ABUSE_CHALLENGE_REQUIRED");
    state=consumeChallenge(state,{
      challengeId:input.challengeId,
      actorId:input.actorContext.actorId,
      sessionId:session.sessionId,
      securityVersion:session.securityVersion,
      auctionId:input.auctionId,
      nowMs:input.nowMs,
    });
    challenged=true;
  }

  const attempts=[...state.attempts,Object.freeze({
    actorId:input.actorContext.actorId,
    trustedSourceKey:required(input.trustedSourceKey,"BID_ABUSE_SOURCE_REQUIRED"),
    auctionId:required(input.auctionId,"BID_ABUSE_AUCTION_REQUIRED"),
    atMs:input.nowMs,
  })].slice(-policy.maxHistory);

  return Object.freeze({
    state:Object.freeze({attempts:Object.freeze(attempts),challenges:state.challenges,lastObservedAtMs:input.nowMs}),
    challenged,
    riskReason:decision.reason,
  });
}
