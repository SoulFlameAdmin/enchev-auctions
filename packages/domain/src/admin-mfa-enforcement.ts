import {
  assertFunctionAuthorized,
  type FunctionAuthorizationContext,
  type FunctionAuthorizationScope,
  type FunctionCapability,
} from "./function-authorization.js";
import {
  assertAuthenticatedSession,
  type SessionSecurityPolicy,
  type SessionSecurityState,
} from "./session-security.js";

export type MfaFactorClass = "knowledge" | "possession" | "inherence";
export type MfaFactorEvidence = Readonly<{
  factorId: string;
  factorClass: MfaFactorClass;
  verifiedAtMs: number;
}>;

export type AdminMfaAssurance = Readonly<{
  source: "server-verified-provider";
  actorId: string;
  sessionId: string;
  securityVersion: number;
  aal: 1 | 2;
  verifiedAtMs: number;
  factors: readonly MfaFactorEvidence[];
}>;

export type AdminMfaPolicy = Readonly<{
  requiredAal: 2;
  minDistinctFactorClasses: 2;
  maxStepUpAgeMs: number;
}>;

export const DEFAULT_ADMIN_MFA_POLICY: AdminMfaPolicy = Object.freeze({
  requiredAal: 2,
  minDistinctFactorClasses: 2,
  maxStepUpAgeMs: 15 * 60 * 1000,
});

function required(value:string, code:string):string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function nonNegativeInt(value:number, code:string):number {
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}

function positiveInt(value:number, code:string):number {
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}

export function validateAdminMfaPolicy(policy:AdminMfaPolicy):AdminMfaPolicy {
  if(policy.requiredAal!==2) throw new Error("ADMIN_MFA_AAL_MUST_BE_2");
  if(policy.minDistinctFactorClasses!==2) throw new Error("ADMIN_MFA_DISTINCT_FACTOR_CLASSES_MUST_BE_2");
  const maxStepUpAgeMs=positiveInt(policy.maxStepUpAgeMs,"ADMIN_MFA_STEP_UP_AGE_INVALID");
  return Object.freeze({requiredAal:2,minDistinctFactorClasses:2,maxStepUpAgeMs});
}

function isPrivilegedActor(context:FunctionAuthorizationContext):boolean {
  return context.roles.includes("admin")||context.roles.includes("security-admin");
}

function validateFactorEvidence(
  factors:readonly MfaFactorEvidence[],
  nowMs:number,
  verifiedAtMs:number,
):readonly MfaFactorEvidence[] {
  if(factors.length<2) throw new Error("ADMIN_MFA_FACTOR_COUNT_INSUFFICIENT");
  const ids=new Set<string>();
  const classes=new Set<MfaFactorClass>();
  const normalized=factors.map(factor=>{
    const factorId=required(factor.factorId,"ADMIN_MFA_FACTOR_ID_REQUIRED");
    if(ids.has(factorId)) throw new Error("ADMIN_MFA_FACTOR_ID_DUPLICATE");
    ids.add(factorId);
    if(!["knowledge","possession","inherence"].includes(factor.factorClass)) throw new Error("ADMIN_MFA_FACTOR_CLASS_INVALID");
    classes.add(factor.factorClass);
    const factorVerifiedAtMs=nonNegativeInt(factor.verifiedAtMs,"ADMIN_MFA_FACTOR_TIME_INVALID");
    if(factorVerifiedAtMs>nowMs) throw new Error("ADMIN_MFA_FACTOR_TIME_FUTURE");
    if(factorVerifiedAtMs>verifiedAtMs) throw new Error("ADMIN_MFA_FACTOR_AFTER_ASSERTION");
    return Object.freeze({...factor,factorId,verifiedAtMs:factorVerifiedAtMs});
  });
  if(classes.size<2) throw new Error("ADMIN_MFA_DISTINCT_FACTOR_CLASSES_INSUFFICIENT");
  return Object.freeze(normalized);
}

export function assertAdminMfaAssurance(
  assurance:AdminMfaAssurance,
  input:Readonly<{
    actorId:string;
    sessionId:string;
    securityVersion:number;
    sessionIssuedAtMs:number;
    nowMs:number;
  }>,
  policyInput:AdminMfaPolicy=DEFAULT_ADMIN_MFA_POLICY,
):true {
  const policy=validateAdminMfaPolicy(policyInput);
  const actorId=required(input.actorId,"ADMIN_MFA_ACTOR_REQUIRED");
  const sessionId=required(input.sessionId,"ADMIN_MFA_SESSION_REQUIRED");
  const nowMs=nonNegativeInt(input.nowMs,"ADMIN_MFA_NOW_INVALID");
  const securityVersion=nonNegativeInt(input.securityVersion,"ADMIN_MFA_SECURITY_VERSION_INVALID");
  const sessionIssuedAtMs=nonNegativeInt(input.sessionIssuedAtMs,"ADMIN_MFA_SESSION_ISSUED_AT_INVALID");

  if(assurance.source!=="server-verified-provider") throw new Error("ADMIN_MFA_SERVER_ASSURANCE_REQUIRED");
  if(required(assurance.actorId,"ADMIN_MFA_ASSURANCE_ACTOR_REQUIRED")!==actorId) throw new Error("ADMIN_MFA_ACTOR_MISMATCH");
  if(required(assurance.sessionId,"ADMIN_MFA_ASSURANCE_SESSION_REQUIRED")!==sessionId) throw new Error("ADMIN_MFA_SESSION_MISMATCH");
  if(nonNegativeInt(assurance.securityVersion,"ADMIN_MFA_ASSURANCE_SECURITY_VERSION_INVALID")!==securityVersion) throw new Error("ADMIN_MFA_SECURITY_VERSION_MISMATCH");
  if(assurance.aal<policy.requiredAal) throw new Error("ADMIN_MFA_AAL_INSUFFICIENT");

  const verifiedAtMs=nonNegativeInt(assurance.verifiedAtMs,"ADMIN_MFA_VERIFIED_AT_INVALID");
  if(verifiedAtMs<sessionIssuedAtMs) throw new Error("ADMIN_MFA_PREDATES_SESSION");
  if(verifiedAtMs>nowMs) throw new Error("ADMIN_MFA_VERIFIED_AT_FUTURE");
  if(nowMs-verifiedAtMs>policy.maxStepUpAgeMs) throw new Error("ADMIN_MFA_STEP_UP_STALE");

  const factors=validateFactorEvidence(assurance.factors,nowMs,verifiedAtMs);
  const distinctClasses=new Set(factors.map(x=>x.factorClass));
  if(distinctClasses.size<policy.minDistinctFactorClasses) throw new Error("ADMIN_MFA_DISTINCT_FACTOR_CLASSES_INSUFFICIENT");

  return true;
}

export function assertMfaProtectedFunctionAuthorized(
  input:Readonly<{
    context:FunctionAuthorizationContext;
    capability:FunctionCapability;
    scope:FunctionAuthorizationScope;
    sessionState:SessionSecurityState;
    sessionPolicy:SessionSecurityPolicy;
    sessionId:string;
    requiredSecurityVersion:number;
    nowMs:number;
    mfaAssurance:AdminMfaAssurance|null;
    mfaPolicy?:AdminMfaPolicy;
  }>,
):true {
  assertFunctionAuthorized(input.context,input.capability,input.scope);
  const session=assertAuthenticatedSession(input.sessionState,{
    sessionId:input.sessionId,
    userId:input.context.actorId,
    nowMs:input.nowMs,
    requiredSecurityVersion:input.requiredSecurityVersion,
  },input.sessionPolicy);

  if(!isPrivilegedActor(input.context)) return true;
  if(!input.mfaAssurance) throw new Error("ADMIN_MFA_REQUIRED");

  assertAdminMfaAssurance(input.mfaAssurance,{
    actorId:input.context.actorId,
    sessionId:session.sessionId,
    securityVersion:session.securityVersion,
    sessionIssuedAtMs:session.issuedAtMs,
    nowMs:input.nowMs,
  },input.mfaPolicy??DEFAULT_ADMIN_MFA_POLICY);

  return true;
}
