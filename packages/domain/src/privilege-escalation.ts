import {
  FUNCTION_AUTHORIZATION_POLICIES,
  type FunctionAuthorizationContext,
  type FunctionCapability,
  type FunctionRole,
} from "./function-authorization.js";
import {
  assertMfaProtectedFunctionAuthorized,
  type AdminMfaAssurance,
  type AdminMfaPolicy,
} from "./admin-mfa-enforcement.js";
import {
  revokeAllAuthenticatedSessions,
  type SessionSecurityPolicy,
  type SessionSecurityState,
} from "./session-security.js";

export type AccountPrivilegeState = Readonly<{
  userId: string;
  accountStatus: "active" | "restricted" | "suspended";
  roles: readonly FunctionRole[];
  permissions: readonly FunctionCapability[];
  securityVersion: number;
}>;

export type PrivilegeMutationRequest = Readonly<{
  targetUserId: string;
  expectedSecurityVersion: number;
  roles: readonly FunctionRole[];
  permissions: readonly FunctionCapability[];
}>;

export type PrivilegeMutationResult = Readonly<{
  target: AccountPrivilegeState;
  sessionState: SessionSecurityState;
  previousSecurityVersion: number;
  newSecurityVersion: number;
  revokedTargetSessions: true;
}>;

const KNOWN_ROLES: readonly FunctionRole[] = Object.freeze([
  "guest","buyer","seller","support","compliance","inspector","yard","auctioneer","admin","security-admin",
]);

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function nonNegativeInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}

function canonicalUnique<T extends string>(values:readonly T[],code:string):readonly T[]{
  const normalized=[...values];
  if(new Set(normalized).size!==normalized.length) throw new Error(code);
  return Object.freeze(normalized.sort());
}

function validateRole(role:FunctionRole):void{
  if(!KNOWN_ROLES.includes(role)) throw new Error("PRIVILEGE_ROLE_UNKNOWN");
}

function validatePermission(permission:FunctionCapability):void{
  if(!Object.hasOwn(FUNCTION_AUTHORIZATION_POLICIES,permission)) throw new Error("PRIVILEGE_PERMISSION_UNKNOWN");
}

function permissionBackedByRole(permission:FunctionCapability,roles:readonly FunctionRole[]):boolean{
  const policy=FUNCTION_AUTHORIZATION_POLICIES[permission];
  return roles.some(role=>policy.allowedRoles.includes(role));
}

function includesSecurityPrivilege(roles:readonly FunctionRole[],permissions:readonly FunctionCapability[]):boolean{
  return roles.includes("security-admin")||permissions.includes("security.break-glass");
}

function actorCanAdministerSecurityPrivileges(context:FunctionAuthorizationContext):boolean{
  return context.roles.includes("admin")
    && context.roles.includes("security-admin")
    && context.permissions.includes("admin.manage-users")
    && context.permissions.includes("security.break-glass");
}

export function applyPrivilegeMutation(input:Readonly<{
  actorContext:FunctionAuthorizationContext;
  actorSessionId:string;
  actorRequiredSecurityVersion:number;
  actorMfaAssurance:AdminMfaAssurance|null;
  actorMfaPolicy?:AdminMfaPolicy;
  sessionState:SessionSecurityState;
  sessionPolicy:SessionSecurityPolicy;
  target:AccountPrivilegeState;
  request:PrivilegeMutationRequest;
  nowMs:number;
}>):PrivilegeMutationResult{
  const nowMs=nonNegativeInt(input.nowMs,"PRIVILEGE_NOW_INVALID");
  const actorId=required(input.actorContext.actorId,"PRIVILEGE_ACTOR_REQUIRED");
  const targetUserId=required(input.target.userId,"PRIVILEGE_TARGET_REQUIRED");
  if(required(input.request.targetUserId,"PRIVILEGE_REQUEST_TARGET_REQUIRED")!==targetUserId) {
    throw new Error("PRIVILEGE_TARGET_MISMATCH");
  }
  if(actorId===targetUserId) throw new Error("PRIVILEGE_SELF_MUTATION_FORBIDDEN");

  assertMfaProtectedFunctionAuthorized({
    context:input.actorContext,
    capability:"admin.manage-users",
    scope:{kind:"global"},
    sessionState:input.sessionState,
    sessionPolicy:input.sessionPolicy,
    sessionId:input.actorSessionId,
    requiredSecurityVersion:input.actorRequiredSecurityVersion,
    nowMs,
    mfaAssurance:input.actorMfaAssurance,
    mfaPolicy:input.actorMfaPolicy,
  });

  const expectedSecurityVersion=nonNegativeInt(input.request.expectedSecurityVersion,"PRIVILEGE_EXPECTED_VERSION_INVALID");
  if(expectedSecurityVersion!==input.target.securityVersion) throw new Error("PRIVILEGE_TARGET_VERSION_STALE");

  const requestedRoles=canonicalUnique(input.request.roles,"PRIVILEGE_DUPLICATE_ROLE");
  const requestedPermissions=canonicalUnique(input.request.permissions,"PRIVILEGE_DUPLICATE_PERMISSION");
  if(requestedRoles.length<1) throw new Error("PRIVILEGE_ROLE_SET_EMPTY");
  requestedRoles.forEach(validateRole);
  requestedPermissions.forEach(validatePermission);

  for(const permission of requestedPermissions){
    if(!permissionBackedByRole(permission,requestedRoles)) throw new Error("PRIVILEGE_PERMISSION_NOT_ROLE_BACKED");
  }

  const beforeSecurity=includesSecurityPrivilege(input.target.roles,input.target.permissions);
  const afterSecurity=includesSecurityPrivilege(requestedRoles,requestedPermissions);
  if(beforeSecurity!==afterSecurity && !actorCanAdministerSecurityPrivileges(input.actorContext)){
    throw new Error("PRIVILEGE_SECURITY_ADMIN_SEPARATION_REQUIRED");
  }

  const sameRoles=JSON.stringify([...input.target.roles].sort())===JSON.stringify([...requestedRoles]);
  const samePermissions=JSON.stringify([...input.target.permissions].sort())===JSON.stringify([...requestedPermissions]);
  if(sameRoles&&samePermissions) throw new Error("PRIVILEGE_NOOP_MUTATION");

  const newSecurityVersion=input.target.securityVersion+1;
  if(!Number.isSafeInteger(newSecurityVersion)) throw new Error("PRIVILEGE_SECURITY_VERSION_OVERFLOW");

  const target:Object & AccountPrivilegeState=Object.freeze({
    userId:targetUserId,
    accountStatus:input.target.accountStatus,
    roles:requestedRoles,
    permissions:requestedPermissions,
    securityVersion:newSecurityVersion,
  });

  const sessionState=revokeAllAuthenticatedSessions(input.sessionState,{userId:targetUserId,nowMs});

  return Object.freeze({
    target,
    sessionState,
    previousSecurityVersion:input.target.securityVersion,
    newSecurityVersion,
    revokedTargetSessions:true,
  });
}
