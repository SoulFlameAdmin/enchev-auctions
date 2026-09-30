export type AuthenticationThrottlePolicy = Readonly<{
  principalLimit: number;
  principalWindowMs: number;
  sourceLimit: number;
  sourceWindowMs: number;
  lockoutBaseMs: number;
  lockoutMaxMs: number;
}>;

export type AuthenticationThrottleState = Readonly<{
  principalFailures: Readonly<Record<string, readonly number[]>>;
  sourceAttempts: Readonly<Record<string, readonly number[]>>;
  principalLockouts: Readonly<Record<string, Readonly<{untilMs:number; level:number}>>>;
}>;

export type AuthenticationAttemptContext = Readonly<{
  principalKey: string;
  sourceKey: string;
  nowMs: number;
}>;

export type AuthenticationThrottleDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
  triggeredBy: "principal" | "source" | null;
  principalRemaining: number;
  sourceRemaining: number;
  state: AuthenticationThrottleState;
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

export function validateAuthenticationThrottlePolicy(policy:AuthenticationThrottlePolicy):AuthenticationThrottlePolicy{
  const principalLimit=positiveInt(policy.principalLimit,"AUTH_THROTTLE_PRINCIPAL_LIMIT_INVALID");
  const principalWindowMs=positiveInt(policy.principalWindowMs,"AUTH_THROTTLE_PRINCIPAL_WINDOW_INVALID");
  const sourceLimit=positiveInt(policy.sourceLimit,"AUTH_THROTTLE_SOURCE_LIMIT_INVALID");
  const sourceWindowMs=positiveInt(policy.sourceWindowMs,"AUTH_THROTTLE_SOURCE_WINDOW_INVALID");
  const lockoutBaseMs=positiveInt(policy.lockoutBaseMs,"AUTH_THROTTLE_LOCKOUT_BASE_INVALID");
  const lockoutMaxMs=positiveInt(policy.lockoutMaxMs,"AUTH_THROTTLE_LOCKOUT_MAX_INVALID");
  if(lockoutMaxMs<lockoutBaseMs) throw new Error("AUTH_THROTTLE_LOCKOUT_RANGE_INVALID");
  return Object.freeze({principalLimit,principalWindowMs,sourceLimit,sourceWindowMs,lockoutBaseMs,lockoutMaxMs});
}

export function emptyAuthenticationThrottleState():AuthenticationThrottleState{
  return Object.freeze({
    principalFailures:Object.freeze({}),
    sourceAttempts:Object.freeze({}),
    principalLockouts:Object.freeze({}),
  });
}

function prune(values:readonly number[]|undefined,nowMs:number,windowMs:number):readonly number[]{
  const floor=nowMs-windowMs;
  return Object.freeze((values??[]).filter(x=>Number.isSafeInteger(x)&&x>floor&&x<=nowMs));
}

function normalizeContext(input:AuthenticationAttemptContext):AuthenticationAttemptContext{
  return Object.freeze({
    principalKey:required(input.principalKey,"AUTH_THROTTLE_PRINCIPAL_KEY_REQUIRED"),
    sourceKey:required(input.sourceKey,"AUTH_THROTTLE_SOURCE_KEY_REQUIRED"),
    nowMs:nonNegativeInt(input.nowMs,"AUTH_THROTTLE_NOW_INVALID"),
  });
}

function withPrunedState(
  state:AuthenticationThrottleState,
  ctx:AuthenticationAttemptContext,
  policy:AuthenticationThrottlePolicy,
):AuthenticationThrottleState{
  const principalFailures={...state.principalFailures};
  const sourceAttempts={...state.sourceAttempts};
  const principalLockouts={...state.principalLockouts};
  principalFailures[ctx.principalKey]=prune(principalFailures[ctx.principalKey],ctx.nowMs,policy.principalWindowMs);
  sourceAttempts[ctx.sourceKey]=prune(sourceAttempts[ctx.sourceKey],ctx.nowMs,policy.sourceWindowMs);
  const lockout=principalLockouts[ctx.principalKey];
  if(lockout&&lockout.untilMs<=ctx.nowMs){
    principalLockouts[ctx.principalKey]=Object.freeze({untilMs:lockout.untilMs,level:lockout.level});
  }
  return Object.freeze({
    principalFailures:Object.freeze(principalFailures),
    sourceAttempts:Object.freeze(sourceAttempts),
    principalLockouts:Object.freeze(principalLockouts),
  });
}

export function checkAuthenticationAttempt(
  stateInput:AuthenticationThrottleState,
  contextInput:AuthenticationAttemptContext,
  policyInput:AuthenticationThrottlePolicy,
):AuthenticationThrottleDecision{
  const policy=validateAuthenticationThrottlePolicy(policyInput);
  const ctx=normalizeContext(contextInput);
  const state=withPrunedState(stateInput,ctx,policy);
  const principalFailures=state.principalFailures[ctx.principalKey]??[];
  const sourceAttempts=state.sourceAttempts[ctx.sourceKey]??[];
  const lockout=state.principalLockouts[ctx.principalKey];

  if(lockout&&lockout.untilMs>ctx.nowMs){
    return Object.freeze({
      allowed:false,
      retryAfterSeconds:Math.max(1,Math.ceil((lockout.untilMs-ctx.nowMs)/1000)),
      triggeredBy:"principal",
      principalRemaining:0,
      sourceRemaining:Math.max(0,policy.sourceLimit-sourceAttempts.length),
      state,
    });
  }

  if(principalFailures.length>=policy.principalLimit){
    const oldest=principalFailures[0]??ctx.nowMs;
    return Object.freeze({
      allowed:false,
      retryAfterSeconds:Math.max(1,Math.ceil((oldest+policy.principalWindowMs-ctx.nowMs)/1000)),
      triggeredBy:"principal",
      principalRemaining:0,
      sourceRemaining:Math.max(0,policy.sourceLimit-sourceAttempts.length),
      state,
    });
  }

  if(sourceAttempts.length>=policy.sourceLimit){
    const oldest=sourceAttempts[0]??ctx.nowMs;
    return Object.freeze({
      allowed:false,
      retryAfterSeconds:Math.max(1,Math.ceil((oldest+policy.sourceWindowMs-ctx.nowMs)/1000)),
      triggeredBy:"source",
      principalRemaining:Math.max(0,policy.principalLimit-principalFailures.length),
      sourceRemaining:0,
      state,
    });
  }

  return Object.freeze({
    allowed:true,
    retryAfterSeconds:0,
    triggeredBy:null,
    principalRemaining:Math.max(0,policy.principalLimit-principalFailures.length),
    sourceRemaining:Math.max(0,policy.sourceLimit-sourceAttempts.length),
    state,
  });
}

export function recordAuthenticationResult(
  stateInput:AuthenticationThrottleState,
  contextInput:AuthenticationAttemptContext,
  result:"success"|"failure",
  policyInput:AuthenticationThrottlePolicy,
):AuthenticationThrottleState{
  const policy=validateAuthenticationThrottlePolicy(policyInput);
  const ctx=normalizeContext(contextInput);
  const state=withPrunedState(stateInput,ctx,policy);
  const principalFailures={...state.principalFailures};
  const sourceAttempts={...state.sourceAttempts};
  const principalLockouts={...state.principalLockouts};

  sourceAttempts[ctx.sourceKey]=Object.freeze([...(sourceAttempts[ctx.sourceKey]??[]),ctx.nowMs]);

  if(result==="success"){
    principalFailures[ctx.principalKey]=Object.freeze([]);
    delete principalLockouts[ctx.principalKey];
  }else{
    const failures=Object.freeze([...(principalFailures[ctx.principalKey]??[]),ctx.nowMs]);
    principalFailures[ctx.principalKey]=failures;
    if(failures.length>=policy.principalLimit){
      const previousLevel=principalLockouts[ctx.principalKey]?.level??0;
      const level=previousLevel+1;
      const duration=Math.min(policy.lockoutMaxMs,policy.lockoutBaseMs*(2**Math.max(0,level-1)));
      principalLockouts[ctx.principalKey]=Object.freeze({untilMs:ctx.nowMs+duration,level});
    }
  }

  return Object.freeze({
    principalFailures:Object.freeze(principalFailures),
    sourceAttempts:Object.freeze(sourceAttempts),
    principalLockouts:Object.freeze(principalLockouts),
  });
}

export function publicAuthenticationFailure():Readonly<{code:"AUTHENTICATION_FAILED";message:string}>{
  return Object.freeze({
    code:"AUTHENTICATION_FAILED",
    message:"Authentication could not be completed.",
  });
}

export function publicAuthenticationThrottle(
  decision:AuthenticationThrottleDecision,
  policyInput:AuthenticationThrottlePolicy,
):Readonly<{retryAfterSeconds:number;limit:number;remaining:0;code:"AUTHENTICATION_THROTTLED";message:string}>{
  if(decision.allowed) throw new Error("AUTH_THROTTLE_RESPONSE_NOT_BLOCKED");
  const policy=validateAuthenticationThrottlePolicy(policyInput);
  return Object.freeze({
    retryAfterSeconds:decision.retryAfterSeconds,
    limit:Math.min(policy.principalLimit,policy.sourceLimit),
    remaining:0,
    code:"AUTHENTICATION_THROTTLED",
    message:"Authentication is temporarily unavailable. Try again later.",
  });
}
