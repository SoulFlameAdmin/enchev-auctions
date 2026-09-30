export type SessionRotationReason = "authentication" | "privilege-change" | "password-change";

export type SessionSecurityPolicy = Readonly<{
  absoluteTtlMs: number;
  idleTimeoutMs: number;
  minSessionIdLength: number;
}>;

export type AuthenticatedSession = Readonly<{
  sessionId: string;
  userId: string;
  securityVersion: number;
  issuedAtMs: number;
  lastSeenAtMs: number;
  absoluteExpiresAtMs: number;
  status: "active" | "revoked";
  revokedAtMs: number | null;
  rotationParentId: string | null;
  rotationReason: SessionRotationReason | null;
}>;

export type SessionSecurityState = Readonly<{
  sessions: readonly AuthenticatedSession[];
}>;

export type SessionCookieContract = Readonly<{
  name: "__Host-enchev-session";
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  domain: null;
}>;

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

export function validateSessionSecurityPolicy(policy:SessionSecurityPolicy):SessionSecurityPolicy {
  const absoluteTtlMs=positiveInt(policy.absoluteTtlMs,"SESSION_ABSOLUTE_TTL_INVALID");
  const idleTimeoutMs=positiveInt(policy.idleTimeoutMs,"SESSION_IDLE_TIMEOUT_INVALID");
  const minSessionIdLength=positiveInt(policy.minSessionIdLength,"SESSION_ID_MIN_LENGTH_INVALID");
  if(idleTimeoutMs>absoluteTtlMs) throw new Error("SESSION_IDLE_EXCEEDS_ABSOLUTE");
  if(minSessionIdLength<16) throw new Error("SESSION_ID_MIN_LENGTH_TOO_LOW");
  return Object.freeze({absoluteTtlMs,idleTimeoutMs,minSessionIdLength});
}

export function emptySessionSecurityState():SessionSecurityState {
  return Object.freeze({sessions:Object.freeze([])});
}

export function sessionCookieContract():SessionCookieContract {
  return Object.freeze({
    name:"__Host-enchev-session",
    httpOnly:true,
    secure:true,
    sameSite:"lax",
    path:"/",
    domain:null,
  });
}

function normalizeGeneratedSessionId(
  sessionIdInput:string,
  state:SessionSecurityState,
  policy:SessionSecurityPolicy,
):string {
  const sessionId=required(sessionIdInput,"SESSION_ID_REQUIRED");
  if(sessionId.length<policy.minSessionIdLength) throw new Error("SESSION_ID_TOO_SHORT");
  if(!/^[A-Za-z0-9._:-]+$/.test(sessionId)) throw new Error("SESSION_ID_FORMAT_INVALID");
  if(state.sessions.some(x=>x.sessionId===sessionId)) throw new Error("SESSION_ID_COLLISION");
  return sessionId;
}

function createRecord(
  state:SessionSecurityState,
  input:Readonly<{
    userId:string;
    nowMs:number;
    securityVersion:number;
    rotationParentId:string|null;
    rotationReason:SessionRotationReason|null;
  }>,
  policyInput:SessionSecurityPolicy,
  generateSessionId:()=>string,
):AuthenticatedSession {
  const policy=validateSessionSecurityPolicy(policyInput);
  const userId=required(input.userId,"SESSION_USER_REQUIRED");
  const nowMs=nonNegativeInt(input.nowMs,"SESSION_NOW_INVALID");
  const securityVersion=nonNegativeInt(input.securityVersion,"SESSION_SECURITY_VERSION_INVALID");
  const sessionId=normalizeGeneratedSessionId(generateSessionId(),state,policy);
  return Object.freeze({
    sessionId,
    userId,
    securityVersion,
    issuedAtMs:nowMs,
    lastSeenAtMs:nowMs,
    absoluteExpiresAtMs:nowMs+policy.absoluteTtlMs,
    status:"active",
    revokedAtMs:null,
    rotationParentId:input.rotationParentId,
    rotationReason:input.rotationReason,
  });
}

export function issueAuthenticatedSession(
  state:SessionSecurityState,
  input:Readonly<{
    userId:string;
    nowMs:number;
    securityVersion:number;
    clientProposedSessionId?:string|null;
  }>,
  policy:SessionSecurityPolicy,
  generateSessionId:()=>string=()=>crypto.randomUUID().replace(/-/g,""),
):Readonly<{state:SessionSecurityState;session:AuthenticatedSession}> {
  if(input.clientProposedSessionId!==undefined&&input.clientProposedSessionId!==null) {
    throw new Error("CLIENT_SESSION_ID_FORBIDDEN");
  }
  const session=createRecord(state,{
    userId:input.userId,
    nowMs:input.nowMs,
    securityVersion:input.securityVersion,
    rotationParentId:null,
    rotationReason:"authentication",
  },policy,generateSessionId);
  return Object.freeze({
    state:Object.freeze({sessions:Object.freeze([...state.sessions,session])}),
    session,
  });
}

export function assertAuthenticatedSession(
  state:SessionSecurityState,
  input:Readonly<{
    sessionId:string;
    userId:string;
    nowMs:number;
    requiredSecurityVersion:number;
  }>,
  policyInput:SessionSecurityPolicy,
):AuthenticatedSession {
  const policy=validateSessionSecurityPolicy(policyInput);
  const sessionId=required(input.sessionId,"SESSION_ID_REQUIRED");
  const userId=required(input.userId,"SESSION_USER_REQUIRED");
  const nowMs=nonNegativeInt(input.nowMs,"SESSION_NOW_INVALID");
  const requiredSecurityVersion=nonNegativeInt(input.requiredSecurityVersion,"SESSION_SECURITY_VERSION_INVALID");
  const session=state.sessions.find(x=>x.sessionId===sessionId);
  if(!session) throw new Error("SESSION_NOT_FOUND");
  if(session.userId!==userId) throw new Error("SESSION_USER_MISMATCH");
  if(session.status!=="active"||session.revokedAtMs!==null) throw new Error("SESSION_REVOKED");
  if(session.securityVersion!==requiredSecurityVersion) throw new Error("SESSION_SECURITY_VERSION_STALE");
  if(nowMs>=session.absoluteExpiresAtMs) throw new Error("SESSION_ABSOLUTE_EXPIRED");
  if(nowMs-session.lastSeenAtMs>=policy.idleTimeoutMs) throw new Error("SESSION_IDLE_EXPIRED");
  if(nowMs<session.issuedAtMs||nowMs<session.lastSeenAtMs) throw new Error("SESSION_TIME_REGRESSION");
  return session;
}

export function touchAuthenticatedSession(
  state:SessionSecurityState,
  input:Readonly<{sessionId:string;userId:string;nowMs:number;requiredSecurityVersion:number}>,
  policy:SessionSecurityPolicy,
):SessionSecurityState {
  const session=assertAuthenticatedSession(state,input,policy);
  const sessions=state.sessions.map(x=>x.sessionId===session.sessionId
    ? Object.freeze({...x,lastSeenAtMs:input.nowMs})
    : x);
  return Object.freeze({sessions:Object.freeze(sessions)});
}

function revokeOne(state:SessionSecurityState, sessionId:string, nowMs:number):SessionSecurityState {
  const sessions=state.sessions.map(x=>x.sessionId===sessionId&&x.status==="active"
    ? Object.freeze({...x,status:"revoked" as const,revokedAtMs:nowMs})
    : x);
  return Object.freeze({sessions:Object.freeze(sessions)});
}

export function rotateAuthenticatedSession(
  stateInput:SessionSecurityState,
  input:Readonly<{
    sessionId:string;
    userId:string;
    nowMs:number;
    requiredSecurityVersion:number;
    newSecurityVersion:number;
    reason:SessionRotationReason;
  }>,
  policy:SessionSecurityPolicy,
  generateSessionId:()=>string=()=>crypto.randomUUID().replace(/-/g,""),
):Readonly<{state:SessionSecurityState;session:AuthenticatedSession;revokedSessionId:string}> {
  const current=assertAuthenticatedSession(stateInput,{
    sessionId:input.sessionId,
    userId:input.userId,
    nowMs:input.nowMs,
    requiredSecurityVersion:input.requiredSecurityVersion,
  },policy);
  const newSecurityVersion=nonNegativeInt(input.newSecurityVersion,"SESSION_SECURITY_VERSION_INVALID");
  if(input.reason==="privilege-change"||input.reason==="password-change") {
    if(newSecurityVersion<=current.securityVersion) throw new Error("SESSION_SECURITY_VERSION_NOT_ADVANCED");
  } else if(newSecurityVersion!==current.securityVersion) {
    throw new Error("SESSION_AUTH_ROTATION_VERSION_DRIFT");
  }
  const revoked=revokeOne(stateInput,current.sessionId,input.nowMs);
  const session=createRecord(revoked,{
    userId:current.userId,
    nowMs:input.nowMs,
    securityVersion:newSecurityVersion,
    rotationParentId:current.sessionId,
    rotationReason:input.reason,
  },policy,generateSessionId);
  return Object.freeze({
    state:Object.freeze({sessions:Object.freeze([...revoked.sessions,session])}),
    session,
    revokedSessionId:current.sessionId,
  });
}

export function revokeAuthenticatedSession(
  state:SessionSecurityState,
  input:Readonly<{sessionId:string;userId:string;nowMs:number}>,
):SessionSecurityState {
  const sessionId=required(input.sessionId,"SESSION_ID_REQUIRED");
  const userId=required(input.userId,"SESSION_USER_REQUIRED");
  const nowMs=nonNegativeInt(input.nowMs,"SESSION_NOW_INVALID");
  const session=state.sessions.find(x=>x.sessionId===sessionId);
  if(!session) return state;
  if(session.userId!==userId) throw new Error("SESSION_USER_MISMATCH");
  if(session.status==="revoked") return state;
  return revokeOne(state,sessionId,nowMs);
}

export function revokeAllAuthenticatedSessions(
  state:SessionSecurityState,
  input:Readonly<{userId:string;nowMs:number}>,
):SessionSecurityState {
  const userId=required(input.userId,"SESSION_USER_REQUIRED");
  const nowMs=nonNegativeInt(input.nowMs,"SESSION_NOW_INVALID");
  const sessions=state.sessions.map(x=>x.userId===userId&&x.status==="active"
    ? Object.freeze({...x,status:"revoked" as const,revokedAtMs:nowMs})
    : x);
  return Object.freeze({sessions:Object.freeze(sessions)});
}
