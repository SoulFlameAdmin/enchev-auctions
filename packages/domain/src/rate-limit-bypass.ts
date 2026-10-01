export type RateLimitBypassPolicy = Readonly<{
  actorLimit:number;
  actorWindowMs:number;
  sourceLimit:number;
  sourceWindowMs:number;
  routeLimit:number;
  routeWindowMs:number;
}>;

export type RateLimitBypassState = Readonly<{
  actorAttempts:Readonly<Record<string,readonly number[]>>;
  sourceAttempts:Readonly<Record<string,readonly number[]>>;
  routeAttempts:Readonly<Record<string,readonly number[]>>;
  lastObservedAtMs:number|null;
}>;

export type RateLimitRequestContext = Readonly<{
  actorKey:string;
  trustedSourceKey:string;
  routeKey:string;
  nowMs:number;
  clientClaimedActorKey?:string|null;
  clientClaimedSourceKey?:string|null;
}>;

export type RateLimitBypassDecision = Readonly<{
  allowed:boolean;
  retryAfterSeconds:number;
  triggeredBy:"actor"|"source"|"route"|null;
  actorRemaining:number;
  sourceRemaining:number;
  routeRemaining:number;
  state:RateLimitBypassState;
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
function prune(values:readonly number[]|undefined,nowMs:number,windowMs:number):readonly number[]{
  const floor=nowMs-windowMs;
  return Object.freeze((values??[]).filter(x=>Number.isSafeInteger(x)&&x>floor&&x<=nowMs));
}
function retryAfter(values:readonly number[],nowMs:number,windowMs:number):number{
  const oldest=values[0]??nowMs;
  return Math.max(1,Math.ceil((oldest+windowMs-nowMs)/1000));
}

export function validateRateLimitBypassPolicy(policy:RateLimitBypassPolicy):RateLimitBypassPolicy{
  return Object.freeze({
    actorLimit:positiveInt(policy.actorLimit,"RATE_LIMIT_ACTOR_LIMIT_INVALID"),
    actorWindowMs:positiveInt(policy.actorWindowMs,"RATE_LIMIT_ACTOR_WINDOW_INVALID"),
    sourceLimit:positiveInt(policy.sourceLimit,"RATE_LIMIT_SOURCE_LIMIT_INVALID"),
    sourceWindowMs:positiveInt(policy.sourceWindowMs,"RATE_LIMIT_SOURCE_WINDOW_INVALID"),
    routeLimit:positiveInt(policy.routeLimit,"RATE_LIMIT_ROUTE_LIMIT_INVALID"),
    routeWindowMs:positiveInt(policy.routeWindowMs,"RATE_LIMIT_ROUTE_WINDOW_INVALID"),
  });
}

export function emptyRateLimitBypassState():RateLimitBypassState{
  return Object.freeze({
    actorAttempts:Object.freeze({}),
    sourceAttempts:Object.freeze({}),
    routeAttempts:Object.freeze({}),
    lastObservedAtMs:null,
  });
}

function normalizeContext(input:RateLimitRequestContext,state:RateLimitBypassState):Required<Pick<RateLimitRequestContext,"actorKey"|"trustedSourceKey"|"routeKey"|"nowMs">>{
  if(input.clientClaimedActorKey!==undefined&&input.clientClaimedActorKey!==null) throw new Error("RATE_LIMIT_CLIENT_ACTOR_CLAIM_FORBIDDEN");
  if(input.clientClaimedSourceKey!==undefined&&input.clientClaimedSourceKey!==null) throw new Error("RATE_LIMIT_CLIENT_SOURCE_CLAIM_FORBIDDEN");
  const nowMs=nonNegativeInt(input.nowMs,"RATE_LIMIT_NOW_INVALID");
  if(state.lastObservedAtMs!==null&&nowMs<state.lastObservedAtMs) throw new Error("RATE_LIMIT_CLOCK_REGRESSION");
  return Object.freeze({
    actorKey:required(input.actorKey,"RATE_LIMIT_ACTOR_KEY_REQUIRED"),
    trustedSourceKey:required(input.trustedSourceKey,"RATE_LIMIT_SOURCE_KEY_REQUIRED"),
    routeKey:required(input.routeKey,"RATE_LIMIT_ROUTE_KEY_REQUIRED"),
    nowMs,
  });
}

function pruneState(
  state:RateLimitBypassState,
  ctx:Required<Pick<RateLimitRequestContext,"actorKey"|"trustedSourceKey"|"routeKey"|"nowMs">>,
  policy:RateLimitBypassPolicy,
):RateLimitBypassState{
  const actorAttempts={...state.actorAttempts};
  const sourceAttempts={...state.sourceAttempts};
  const routeAttempts={...state.routeAttempts};
  actorAttempts[ctx.actorKey]=prune(actorAttempts[ctx.actorKey],ctx.nowMs,policy.actorWindowMs);
  sourceAttempts[ctx.trustedSourceKey]=prune(sourceAttempts[ctx.trustedSourceKey],ctx.nowMs,policy.sourceWindowMs);
  routeAttempts[ctx.routeKey]=prune(routeAttempts[ctx.routeKey],ctx.nowMs,policy.routeWindowMs);
  return Object.freeze({
    actorAttempts:Object.freeze(actorAttempts),
    sourceAttempts:Object.freeze(sourceAttempts),
    routeAttempts:Object.freeze(routeAttempts),
    lastObservedAtMs:ctx.nowMs,
  });
}

export function checkRateLimitBypass(
  stateInput:RateLimitBypassState,
  contextInput:RateLimitRequestContext,
  policyInput:RateLimitBypassPolicy,
):RateLimitBypassDecision{
  const policy=validateRateLimitBypassPolicy(policyInput);
  const ctx=normalizeContext(contextInput,stateInput);
  const state=pruneState(stateInput,ctx,policy);
  const actor=state.actorAttempts[ctx.actorKey]??[];
  const source=state.sourceAttempts[ctx.trustedSourceKey]??[];
  const route=state.routeAttempts[ctx.routeKey]??[];

  if(actor.length>=policy.actorLimit){
    return Object.freeze({
      allowed:false,retryAfterSeconds:retryAfter(actor,ctx.nowMs,policy.actorWindowMs),triggeredBy:"actor",
      actorRemaining:0,
      sourceRemaining:Math.max(0,policy.sourceLimit-source.length),
      routeRemaining:Math.max(0,policy.routeLimit-route.length),
      state,
    });
  }
  if(source.length>=policy.sourceLimit){
    return Object.freeze({
      allowed:false,retryAfterSeconds:retryAfter(source,ctx.nowMs,policy.sourceWindowMs),triggeredBy:"source",
      actorRemaining:Math.max(0,policy.actorLimit-actor.length),
      sourceRemaining:0,
      routeRemaining:Math.max(0,policy.routeLimit-route.length),
      state,
    });
  }
  if(route.length>=policy.routeLimit){
    return Object.freeze({
      allowed:false,retryAfterSeconds:retryAfter(route,ctx.nowMs,policy.routeWindowMs),triggeredBy:"route",
      actorRemaining:Math.max(0,policy.actorLimit-actor.length),
      sourceRemaining:Math.max(0,policy.sourceLimit-source.length),
      routeRemaining:0,
      state,
    });
  }

  return Object.freeze({
    allowed:true,retryAfterSeconds:0,triggeredBy:null,
    actorRemaining:Math.max(0,policy.actorLimit-actor.length),
    sourceRemaining:Math.max(0,policy.sourceLimit-source.length),
    routeRemaining:Math.max(0,policy.routeLimit-route.length),
    state,
  });
}

export function recordRateLimitedRequest(
  stateInput:RateLimitBypassState,
  contextInput:RateLimitRequestContext,
  policyInput:RateLimitBypassPolicy,
):RateLimitBypassState{
  const policy=validateRateLimitBypassPolicy(policyInput);
  const pre=checkRateLimitBypass(stateInput,contextInput,policy);
  if(!pre.allowed) throw new Error("RATE_LIMIT_REQUEST_ALREADY_BLOCKED");
  const ctx=normalizeContext(contextInput,pre.state);
  const actorAttempts={...pre.state.actorAttempts};
  const sourceAttempts={...pre.state.sourceAttempts};
  const routeAttempts={...pre.state.routeAttempts};
  actorAttempts[ctx.actorKey]=Object.freeze([...(actorAttempts[ctx.actorKey]??[]),ctx.nowMs]);
  sourceAttempts[ctx.trustedSourceKey]=Object.freeze([...(sourceAttempts[ctx.trustedSourceKey]??[]),ctx.nowMs]);
  routeAttempts[ctx.routeKey]=Object.freeze([...(routeAttempts[ctx.routeKey]??[]),ctx.nowMs]);
  return Object.freeze({
    actorAttempts:Object.freeze(actorAttempts),
    sourceAttempts:Object.freeze(sourceAttempts),
    routeAttempts:Object.freeze(routeAttempts),
    lastObservedAtMs:ctx.nowMs,
  });
}

export function publicRateLimitBypassResponse(
  decision:RateLimitBypassDecision,
  policyInput:RateLimitBypassPolicy,
):Readonly<{retryAfterSeconds:number;limit:number;remaining:0;code:"RATE_LIMITED";message:string}>{
  if(decision.allowed) throw new Error("RATE_LIMIT_RESPONSE_NOT_BLOCKED");
  const policy=validateRateLimitBypassPolicy(policyInput);
  return Object.freeze({
    retryAfterSeconds:decision.retryAfterSeconds,
    limit:Math.min(policy.actorLimit,policy.sourceLimit,policy.routeLimit),
    remaining:0,
    code:"RATE_LIMITED",
    message:"Too many requests. Try again later.",
  });
}
