export type FunctionRole =
  | "guest"
  | "buyer"
  | "seller"
  | "support"
  | "compliance"
  | "inspector"
  | "yard"
  | "auctioneer"
  | "admin"
  | "security-admin";

export type FunctionCapability =
  | "buyer.submit-bid"
  | "seller.autosave-listing"
  | "seller.lower-reserve"
  | "support.manage-case"
  | "compliance.review-identity"
  | "inspector.submit-inspection"
  | "yard.update-custody"
  | "auctioneer.control-lane"
  | "admin.manage-users"
  | "admin.manage-feature-flags"
  | "security.break-glass";

export type FunctionAuthorizationContext = Readonly<{
  actorId: string;
  source: "server-session";
  accountStatus: "active" | "restricted" | "suspended";
  roles: readonly FunctionRole[];
  permissions: readonly FunctionCapability[];
  scopeKeys: readonly string[];
}>;

export type FunctionAuthorizationScope =
  | Readonly<{kind:"own";ownerActorId:string}>
  | Readonly<{kind:"assigned";resourceKey:string}>
  | Readonly<{kind:"global"}>;

type FunctionPolicy = Readonly<{
  allowedRoles: readonly FunctionRole[];
  scope: FunctionAuthorizationScope["kind"];
}>;

export const FUNCTION_AUTHORIZATION_POLICIES: Readonly<Record<FunctionCapability,FunctionPolicy>> = Object.freeze({
  "buyer.submit-bid": Object.freeze({allowedRoles:Object.freeze(["buyer"] as const),scope:"own"}),
  "seller.autosave-listing": Object.freeze({allowedRoles:Object.freeze(["seller"] as const),scope:"own"}),
  "seller.lower-reserve": Object.freeze({allowedRoles:Object.freeze(["seller"] as const),scope:"own"}),
  "support.manage-case": Object.freeze({allowedRoles:Object.freeze(["support","admin"] as const),scope:"assigned"}),
  "compliance.review-identity": Object.freeze({allowedRoles:Object.freeze(["compliance","admin"] as const),scope:"assigned"}),
  "inspector.submit-inspection": Object.freeze({allowedRoles:Object.freeze(["inspector","admin"] as const),scope:"assigned"}),
  "yard.update-custody": Object.freeze({allowedRoles:Object.freeze(["yard","admin"] as const),scope:"assigned"}),
  "auctioneer.control-lane": Object.freeze({allowedRoles:Object.freeze(["auctioneer","admin"] as const),scope:"assigned"}),
  "admin.manage-users": Object.freeze({allowedRoles:Object.freeze(["admin"] as const),scope:"global"}),
  "admin.manage-feature-flags": Object.freeze({allowedRoles:Object.freeze(["admin"] as const),scope:"global"}),
  "security.break-glass": Object.freeze({allowedRoles:Object.freeze(["security-admin"] as const),scope:"global"}),
});

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

export function assertFunctionAuthorized(
  context:FunctionAuthorizationContext,
  capability:FunctionCapability,
  scope:FunctionAuthorizationScope,
):true{
  const actorId=required(context.actorId,"FUNCTION_AUTH_ACTOR_REQUIRED");
  if(context.source!=="server-session") throw new Error("FUNCTION_AUTH_SERVER_CONTEXT_REQUIRED");
  if(context.accountStatus!=="active") throw new Error("FUNCTION_AUTH_ACCOUNT_NOT_ACTIVE");
  const policy=FUNCTION_AUTHORIZATION_POLICIES[capability];
  if(!policy) throw new Error("FUNCTION_AUTH_CAPABILITY_UNKNOWN");

  const roleAllowed=context.roles.some(role=>policy.allowedRoles.includes(role));
  if(!roleAllowed) throw new Error("FUNCTION_AUTH_ROLE_FORBIDDEN");
  if(!context.permissions.includes(capability)) throw new Error("FUNCTION_AUTH_PERMISSION_REQUIRED");
  if(scope.kind!==policy.scope) throw new Error("FUNCTION_AUTH_SCOPE_KIND_MISMATCH");

  if(scope.kind==="own"){
    if(required(scope.ownerActorId,"FUNCTION_AUTH_OWNER_REQUIRED")!==actorId) throw new Error("FUNCTION_AUTH_FOREIGN_OBJECT");
  }else if(scope.kind==="assigned"){
    const resourceKey=required(scope.resourceKey,"FUNCTION_AUTH_RESOURCE_REQUIRED");
    const assignment=capability+":"+resourceKey;
    if(!context.scopeKeys.includes(assignment)) throw new Error("FUNCTION_AUTH_SCOPE_FORBIDDEN");
  }

  return true;
}
