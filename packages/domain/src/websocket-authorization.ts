import {
  assertFunctionAuthorized,
  type FunctionAuthorizationContext,
  type FunctionCapability,
  type FunctionRole,
} from "./function-authorization.js";
import {
  assertAuthenticatedSession,
  type SessionSecurityPolicy,
  type SessionSecurityState,
} from "./session-security.js";

export type WebSocketRoomAction = "watch" | "bid" | "operate";

export type WebSocketConnectionContext = Readonly<{
  connectionId: string;
  source: "server-upgraded-socket";
  actorId: string;
  sessionId: string;
  securityVersion: number;
  accountStatus: "active" | "restricted" | "suspended";
  roles: readonly FunctionRole[];
  permissions: readonly FunctionCapability[];
  scopeKeys: readonly string[];
  connectedAtMs: number;
}>;

export type WebSocketRoomGrant = Readonly<{
  grantId: string;
  actorId: string;
  sessionId: string;
  securityVersion: number;
  auctionId: string;
  actions: readonly WebSocketRoomAction[];
  issuedAtMs: number;
  expiresAtMs: number;
}>;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}
function nonNegativeInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}
function positiveInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}
function roomKey(auctionId:string):string{
  return "auction:"+required(auctionId,"WS_AUCTION_REQUIRED");
}
function uniqueActions(actions:readonly WebSocketRoomAction[]):readonly WebSocketRoomAction[]{
  const allowed:readonly WebSocketRoomAction[]=["watch","bid","operate"];
  if(actions.length<1) throw new Error("WS_GRANT_ACTIONS_REQUIRED");
  if(actions.some(x=>!allowed.includes(x))) throw new Error("WS_GRANT_ACTION_INVALID");
  if(new Set(actions).size!==actions.length) throw new Error("WS_GRANT_ACTION_DUPLICATE");
  return Object.freeze([...actions].sort());
}

export function authorizeWebSocketHandshake(input:Readonly<{
  sessionState:SessionSecurityState;
  sessionPolicy:SessionSecurityPolicy;
  connectionId:string;
  actorId:string;
  sessionId:string;
  securityVersion:number;
  accountStatus:"active"|"restricted"|"suspended";
  roles:readonly FunctionRole[];
  permissions:readonly FunctionCapability[];
  scopeKeys:readonly string[];
  connectedAtMs:number;
  clientClaimedActorId?:string|null;
  clientClaimedRoles?:readonly string[]|null;
}>):WebSocketConnectionContext{
  if(input.clientClaimedActorId!==undefined&&input.clientClaimedActorId!==null) throw new Error("WS_CLIENT_ACTOR_CLAIM_FORBIDDEN");
  if(input.clientClaimedRoles!==undefined&&input.clientClaimedRoles!==null) throw new Error("WS_CLIENT_ROLE_CLAIM_FORBIDDEN");
  const connectionId=required(input.connectionId,"WS_CONNECTION_ID_REQUIRED");
  const actorId=required(input.actorId,"WS_ACTOR_REQUIRED");
  const sessionId=required(input.sessionId,"WS_SESSION_REQUIRED");
  const connectedAtMs=nonNegativeInt(input.connectedAtMs,"WS_CONNECTED_AT_INVALID");
  const securityVersion=nonNegativeInt(input.securityVersion,"WS_SECURITY_VERSION_INVALID");
  if(input.accountStatus!=="active") throw new Error("WS_ACCOUNT_NOT_ACTIVE");

  assertAuthenticatedSession(input.sessionState,{
    sessionId,
    userId:actorId,
    nowMs:connectedAtMs,
    requiredSecurityVersion:securityVersion,
  },input.sessionPolicy);

  return Object.freeze({
    connectionId,
    source:"server-upgraded-socket",
    actorId,
    sessionId,
    securityVersion,
    accountStatus:input.accountStatus,
    roles:Object.freeze([...input.roles]),
    permissions:Object.freeze([...input.permissions]),
    scopeKeys:Object.freeze([...input.scopeKeys]),
    connectedAtMs,
  });
}

export function issueWebSocketRoomGrant(input:Readonly<{
  context:WebSocketConnectionContext;
  grantId:string;
  auctionId:string;
  actions:readonly WebSocketRoomAction[];
  issuedAtMs:number;
  ttlMs:number;
}>):WebSocketRoomGrant{
  if(input.context.source!=="server-upgraded-socket") throw new Error("WS_SERVER_CONTEXT_REQUIRED");
  const grantId=required(input.grantId,"WS_GRANT_ID_REQUIRED");
  const auctionId=required(input.auctionId,"WS_AUCTION_REQUIRED");
  const issuedAtMs=nonNegativeInt(input.issuedAtMs,"WS_GRANT_ISSUED_AT_INVALID");
  const ttlMs=positiveInt(input.ttlMs,"WS_GRANT_TTL_INVALID");
  if(issuedAtMs<input.context.connectedAtMs) throw new Error("WS_GRANT_PREDATES_CONNECTION");
  return Object.freeze({
    grantId,
    actorId:input.context.actorId,
    sessionId:input.context.sessionId,
    securityVersion:input.context.securityVersion,
    auctionId,
    actions:uniqueActions(input.actions),
    issuedAtMs,
    expiresAtMs:issuedAtMs+ttlMs,
  });
}

function asFunctionContext(context:WebSocketConnectionContext):FunctionAuthorizationContext{
  return Object.freeze({
    actorId:context.actorId,
    source:"server-session",
    accountStatus:context.accountStatus,
    roles:context.roles,
    permissions:context.permissions,
    scopeKeys:context.scopeKeys,
  });
}

export function assertWebSocketRoomAuthorized(input:Readonly<{
  sessionState:SessionSecurityState;
  sessionPolicy:SessionSecurityPolicy;
  context:WebSocketConnectionContext;
  grant:WebSocketRoomGrant;
  auctionId:string;
  action:WebSocketRoomAction;
  nowMs:number;
}>):true{
  const nowMs=nonNegativeInt(input.nowMs,"WS_NOW_INVALID");
  if(input.context.source!=="server-upgraded-socket") throw new Error("WS_SERVER_CONTEXT_REQUIRED");
  if(input.context.accountStatus!=="active") throw new Error("WS_ACCOUNT_NOT_ACTIVE");

  const session=assertAuthenticatedSession(input.sessionState,{
    sessionId:input.context.sessionId,
    userId:input.context.actorId,
    nowMs,
    requiredSecurityVersion:input.context.securityVersion,
  },input.sessionPolicy);

  const auctionId=required(input.auctionId,"WS_AUCTION_REQUIRED");
  if(input.grant.actorId!==input.context.actorId) throw new Error("WS_GRANT_ACTOR_MISMATCH");
  if(input.grant.sessionId!==session.sessionId) throw new Error("WS_GRANT_SESSION_MISMATCH");
  if(input.grant.securityVersion!==session.securityVersion) throw new Error("WS_GRANT_SECURITY_VERSION_MISMATCH");
  if(input.grant.auctionId!==auctionId) throw new Error("WS_CROSS_AUCTION_FORBIDDEN");
  if(input.grant.issuedAtMs<input.context.connectedAtMs) throw new Error("WS_GRANT_PREDATES_CONNECTION");
  if(nowMs<input.grant.issuedAtMs) throw new Error("WS_TIME_REGRESSION");
  if(nowMs>=input.grant.expiresAtMs) throw new Error("WS_GRANT_EXPIRED");
  if(!input.grant.actions.includes(input.action)) throw new Error("WS_ROOM_ACTION_FORBIDDEN");

  const fctx=asFunctionContext(input.context);
  if(input.action==="bid"){
    assertFunctionAuthorized(fctx,"buyer.submit-bid",{kind:"own",ownerActorId:input.context.actorId});
  }else if(input.action==="operate"){
    assertFunctionAuthorized(fctx,"auctioneer.control-lane",{kind:"assigned",resourceKey:auctionId});
  }
  roomKey(auctionId);
  return true;
}
