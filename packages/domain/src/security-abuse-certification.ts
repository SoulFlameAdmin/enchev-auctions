export type EnchevRole =
  | "guest"
  | "buyer"
  | "seller"
  | "support"
  | "compliance"
  | "inspector"
  | "yard"
  | "auctioneer"
  | "admin";

export type ObjectScope = {
  ownerUserId?: string | null;
  assignedUserIds?: readonly string[];
  organizationId?: string | null;
  assignedOrganizationIds?: readonly string[];
};

export type SecurityPrincipal = {
  userId: string;
  roles: readonly EnchevRole[];
  organizationIds?: readonly string[];
  sessionId?: string | null;
};

export type AuthorizationDecision = {
  allowed: boolean;
  code: string;
  reason: string;
};

function required(value: unknown, code: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function normalizedRoles(roles: readonly EnchevRole[] | undefined): Set<EnchevRole> {
  return new Set(roles ?? []);
}

export function authorizeObjectAccess(input: {
  principal: SecurityPrincipal;
  action: "read" | "update" | "delete";
  scope: ObjectScope;
  adminOverride?: boolean;
}): AuthorizationDecision {
  const userId=required(input.principal?.userId,"SECURITY_PRINCIPAL_REQUIRED");
  const roles=normalizedRoles(input.principal.roles);
  const owner=input.scope.ownerUserId ? String(input.scope.ownerUserId) : null;
  const assigned=new Set((input.scope.assignedUserIds ?? []).map(String));
  const principalOrgs=new Set((input.principal.organizationIds ?? []).map(String));
  const assignedOrgs=new Set((input.scope.assignedOrganizationIds ?? []).map(String));

  if(input.adminOverride===true && roles.has("admin")) {
    return {allowed:true,code:"ALLOW_SCOPED_ADMIN",reason:"explicit-admin-override"};
  }
  if(owner===userId) {
    return {allowed:true,code:"ALLOW_OWNER",reason:"object-owner-match"};
  }
  if(assigned.has(userId)) {
    return {allowed:true,code:"ALLOW_ASSIGNED_USER",reason:"explicit-user-assignment"};
  }
  if([...principalOrgs].some(org=>assignedOrgs.has(org))) {
    return {allowed:true,code:"ALLOW_ASSIGNED_ORG",reason:"explicit-organization-assignment"};
  }
  return {allowed:false,code:"DENY_OBJECT_SCOPE",reason:"principal-has-no-object-scope"};
}

const FUNCTION_PERMISSIONS: Readonly<Record<string, readonly EnchevRole[]>> = Object.freeze({
  "buyer.submit_bid": ["buyer"],
  "seller.edit_listing": ["seller"],
  "support.update_case": ["support","admin"],
  "compliance.review_identity": ["compliance","admin"],
  "yard.record_custody": ["yard","admin"],
  "auctioneer.operate_lane": ["auctioneer","admin"],
  "admin.manage_roles": ["admin"],
});

export function authorizeFunction(input: {
  principal: SecurityPrincipal;
  capability: string;
}): AuthorizationDecision {
  required(input.principal?.userId,"SECURITY_PRINCIPAL_REQUIRED");
  const capability=required(input.capability,"SECURITY_CAPABILITY_REQUIRED");
  const allowedRoles=FUNCTION_PERMISSIONS[capability];
  if(!allowedRoles) {
    return {allowed:false,code:"DENY_UNKNOWN_CAPABILITY",reason:"capability-not-registered"};
  }
  const roles=normalizedRoles(input.principal.roles);
  if(allowedRoles.some(role=>roles.has(role))) {
    return {allowed:true,code:"ALLOW_ROLE_CAPABILITY",reason:"explicit-role-capability"};
  }
  return {allowed:false,code:"DENY_FUNCTION_ROLE",reason:"role-not-authorized-for-capability"};
}

export type BruteForceState = {
  failures: number;
  windowStartedAtMs: number;
  lockedUntilMs: number;
};

export class AuthenticationBruteForceGuard {
  readonly maxFailures: number;
  readonly windowMs: number;
  readonly lockoutMs: number;
  #states=new Map<string,BruteForceState>();

  constructor(options:{maxFailures?:number;windowMs?:number;lockoutMs?:number}={}) {
    this.maxFailures=options.maxFailures ?? 5;
    this.windowMs=options.windowMs ?? 5*60_000;
    this.lockoutMs=options.lockoutMs ?? 15*60_000;
    if(!Number.isInteger(this.maxFailures)||this.maxFailures<2||this.maxFailures>20) throw new Error("AUTH_GUARD_MAX_FAILURES_INVALID");
    if(!Number.isInteger(this.windowMs)||this.windowMs<1_000) throw new Error("AUTH_GUARD_WINDOW_INVALID");
    if(!Number.isInteger(this.lockoutMs)||this.lockoutMs<1_000) throw new Error("AUTH_GUARD_LOCKOUT_INVALID");
  }

  check(key:string,nowMs:number):AuthorizationDecision {
    const k=required(key,"AUTH_GUARD_KEY_REQUIRED");
    if(!Number.isFinite(nowMs)||nowMs<0) throw new Error("AUTH_GUARD_TIME_INVALID");
    const s=this.#states.get(k);
    if(s && s.lockedUntilMs>nowMs) return {allowed:false,code:"DENY_AUTH_LOCKED",reason:"temporary-auth-lockout"};
    return {allowed:true,code:"ALLOW_AUTH_ATTEMPT",reason:"within-auth-attempt-budget"};
  }

  recordFailure(key:string,nowMs:number):BruteForceState {
    const k=required(key,"AUTH_GUARD_KEY_REQUIRED");
    if(!Number.isFinite(nowMs)||nowMs<0) throw new Error("AUTH_GUARD_TIME_INVALID");
    const prior=this.#states.get(k);
    const expired=!prior || nowMs-prior.windowStartedAtMs>=this.windowMs;
    const base=expired ? {failures:0,windowStartedAtMs:nowMs,lockedUntilMs:0} : {...prior};
    base.failures+=1;
    if(base.failures>=this.maxFailures) base.lockedUntilMs=Math.max(base.lockedUntilMs,nowMs+this.lockoutMs);
    this.#states.set(k,base);
    return {...base};
  }

  recordSuccess(key:string):void {
    const k=required(key,"AUTH_GUARD_KEY_REQUIRED");
    this.#states.delete(k);
  }

  snapshot(key:string):BruteForceState|null {
    const k=required(key,"AUTH_GUARD_KEY_REQUIRED");
    const s=this.#states.get(k);
    return s ? {...s} : null;
  }
}

type SessionRecord = {
  sessionId: string;
  userId: string;
  createdAtMs: number;
  authenticatedAtMs: number;
  revokedAtMs: number | null;
  replacedBySessionId: string | null;
};

export class SessionSecurityRegistry {
  #sessions=new Map<string,SessionRecord>();

  issuePreAuthSession(input:{sessionId:string;userId:string;nowMs:number}):SessionRecord {
    const sessionId=required(input.sessionId,"SESSION_ID_REQUIRED");
    const userId=required(input.userId,"SESSION_USER_REQUIRED");
    if(!Number.isFinite(input.nowMs)||input.nowMs<0) throw new Error("SESSION_TIME_INVALID");
    if(this.#sessions.has(sessionId)) throw new Error("SESSION_ID_REUSE_FORBIDDEN");
    const row={sessionId,userId,createdAtMs:input.nowMs,authenticatedAtMs:0,revokedAtMs:null,replacedBySessionId:null};
    this.#sessions.set(sessionId,row);
    return {...row};
  }

  rotateOnAuthentication(input:{oldSessionId:string;newSessionId:string;userId:string;nowMs:number}):SessionRecord {
    const oldId=required(input.oldSessionId,"SESSION_OLD_ID_REQUIRED");
    const newId=required(input.newSessionId,"SESSION_NEW_ID_REQUIRED");
    const userId=required(input.userId,"SESSION_USER_REQUIRED");
    if(oldId===newId) throw new Error("SESSION_FIXATION_ROTATION_REQUIRED");
    if(!Number.isFinite(input.nowMs)||input.nowMs<0) throw new Error("SESSION_TIME_INVALID");
    const old=this.#sessions.get(oldId);
    if(!old||old.userId!==userId||old.revokedAtMs!==null) throw new Error("SESSION_OLD_INVALID");
    if(this.#sessions.has(newId)) throw new Error("SESSION_ID_REUSE_FORBIDDEN");
    old.revokedAtMs=input.nowMs;
    old.replacedBySessionId=newId;
    const next={sessionId:newId,userId,createdAtMs:input.nowMs,authenticatedAtMs:input.nowMs,revokedAtMs:null,replacedBySessionId:null};
    this.#sessions.set(newId,next);
    return {...next};
  }

  revoke(sessionId:string,nowMs:number):SessionRecord {
    const id=required(sessionId,"SESSION_ID_REQUIRED");
    if(!Number.isFinite(nowMs)||nowMs<0) throw new Error("SESSION_TIME_INVALID");
    const row=this.#sessions.get(id);
    if(!row) throw new Error("SESSION_NOT_FOUND");
    if(row.revokedAtMs===null) row.revokedAtMs=nowMs;
    return {...row};
  }

  authorize(sessionId:string,userId:string):AuthorizationDecision {
    const id=required(sessionId,"SESSION_ID_REQUIRED");
    const uid=required(userId,"SESSION_USER_REQUIRED");
    const row=this.#sessions.get(id);
    if(!row) return {allowed:false,code:"DENY_SESSION_UNKNOWN",reason:"session-not-found"};
    if(row.userId!==uid) return {allowed:false,code:"DENY_SESSION_SUBJECT",reason:"session-subject-mismatch"};
    if(row.revokedAtMs!==null) return {allowed:false,code:"DENY_SESSION_REVOKED",reason:"session-revoked"};
    if(row.authenticatedAtMs<=0) return {allowed:false,code:"DENY_SESSION_PREAUTH",reason:"session-not-authenticated"};
    return {allowed:true,code:"ALLOW_SESSION",reason:"active-authenticated-session"};
  }

  snapshot(sessionId:string):SessionRecord|null {
    const id=required(sessionId,"SESSION_ID_REQUIRED");
    const row=this.#sessions.get(id);
    return row ? {...row} : null;
  }
}
