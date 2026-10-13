import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { sameOriginPost } from "../../../lib/enchev-auth-server";
import {
  ETAP1_ROLES, codeValid, clearEtap1Cookie, etap1Body, etap1Config,
  etap1Json, etap1Rpc, issueEtap1Cookie, etap1Session, type Etap1Role,
} from "../../../lib/etap1-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{action:string}> };

export async function GET(request: NextRequest, context: Context) {
  const {action} = await context.params;
  if (action !== "state") return etap1Json({error:"Not found"},404);
  const config = etap1Config();
  if (!config) return etap1Json({available:false, authenticated:false, error:"Pilot not activated"},503);
  const session=etap1Session(request,config);
  if (!session) return etap1Json({available:true,authenticated:false},401);
  try {
    const result=await etap1Rpc(config,"etap1_ready_lobby_secure",{
      p_actor:session.role,p_session_id:session.sid,
    }) as {state:unknown;lobby:{sessionCurrent?:boolean;admitted?:boolean}};
    if (result.lobby?.sessionCurrent===false)
      return etap1Json({available:true,authenticated:false,error:"Session replaced. Sign in again."},401);
    return etap1Json({available:true,authenticated:true,role:session.role,state:result.state,lobby:result.lobby});
  } catch {
    return etap1Json({error:"Demo database temporarily unavailable"},503);
  }
}

export async function POST(request: NextRequest, context: Context) {
  if (!sameOriginPost(request)) return etap1Json({error:"Invalid request origin"},403);
  const {action} = await context.params;
  if (!["login","logout","start","bid","ready","wallet"].includes(action)) return etap1Json({error:"Not found"},404);
  const config = etap1Config();
  if (!config) return etap1Json({error:"Pilot not activated"},503);

  if (action === "logout") {
    const scope=request.nextUrl.searchParams.get("scope")==="admin"?"admin":"bidder";
    const previous=etap1Session(request,config,scope);
    if (scope==="bidder" && previous && previous.role!=="admin") {
      try {
        await etap1Rpc(config,"etap1_device_signout",{
          p_actor:previous.role,p_session_id:previous.sid,
        });
      } catch {
        // Do not claim a remote sign-out if the authoritative database did not confirm it.
        return etap1Json({error:"Could not end device session. Retry sign out."},503);
      }
    }
    const response=etap1Json({ok:true});
    clearEtap1Cookie(response,scope);
    return response;
  }
  const body=await etap1Body(request);
  if (!body) return etap1Json({error:"Valid JSON request required"},400);

  if (action === "login") {
    const role=body.role;
    const code=body.code;
    if (typeof role !== "string" || !ETAP1_ROLES.includes(role as Etap1Role) ||
      typeof code !== "string" || code.length > 256)
      return etap1Json({error:"Invalid demo access code"},401);
    let valid = codeValid(role as Etap1Role,code,config);
    if (!valid && role === "admin" && code.length >= 20 && code.length <= 128) {
      // Optional salted bcrypt operator credential; service-role verification
      // lives in the isolated Supabase DB. No password or hash in Git/Vercel.
      try {
        valid = (await etap1Rpc(config,"etap1_admin_code_matches",{p_code:code})) === true;
      } catch { valid = false; }
    }
    if (!valid) return etap1Json({error:"Invalid demo access code"},401);
    const sid=randomUUID();
    // Each login obtains an independent signed device session; the role is
    // counted once in READY/auction even if used on multiple devices.
    if (role !== "admin") {
      try {
        await etap1Rpc(config,"etap1_join_lobby_automatic",{
          p_actor:role,p_session_id:sid,
        });
      } catch {
        return etap1Json({error:"Demo lobby unavailable. Login was not activated."},503);
      }
    }
    const response=etap1Json({ok:true,role});
    issueEtap1Cookie(response,role as Etap1Role,sid,config);
    return response;
  }

  const session=etap1Session(request,config);
  if (!session) return etap1Json({error:"Session expired. Sign in again."},401);
  const {role,sid}=session;

  if (action === "wallet") {
    if (role !== "mitko" && role !== "borko" && role !== "enchev")
      return etap1Json({error:"Bidder only"},403);
    const topup=body.topup ?? 0;
    const budget=body.lotBudget ?? null;
    if (typeof topup!=="number" || !Number.isSafeInteger(topup) || topup<0 || topup>90000 ||
      (budget!==null && (typeof budget!=="number" || !Number.isSafeInteger(budget) || budget<0 || budget>100000)))
      return etap1Json({error:"Invalid DEMO buying power or lot budget"},400);
    try {
      const result=await etap1Rpc(config,"etap1_wallet_update_secure",{
        p_actor:role,p_session_id:sid,p_topup:topup,p_lot_budget:budget
      }) as {state:unknown;lobby:{sessionCurrent?:boolean}};
      if(result.lobby?.sessionCurrent===false)
        return etap1Json({error:"Session replaced. Sign in again."},401);
      return etap1Json({ok:true,state:result.state,lobby:result.lobby});
    }catch{
      return etap1Json({error:"DEMO balance rejected. Stay in lobby, unready and respect your 100,000 EUR limit."},409);
    }
  }

  if (action === "ready") {
    if (role !== "mitko" && role !== "borko" && role !== "enchev")
      return etap1Json({error:"Only participants can press READY"},403);
    if (typeof body.ready !== "boolean")
      return etap1Json({error:"Boolean ready flag required"},400);
    try {
      const result=await etap1Rpc(config,"etap1_ready_lobby_secure",{
        p_actor:role,p_session_id:sid,p_ready:body.ready,
      }) as {state:unknown;lobby:{sessionCurrent?:boolean}};
      if (result.lobby?.sessionCurrent===false)
        return etap1Json({error:"Session replaced. Sign in again."},401);
      return etap1Json({ok:true,state:result.state,lobby:result.lobby});
    } catch {
      return etap1Json({error:"READY update failed or demo service unavailable"},409);
    }
  }

  if (action === "start") {
    if (role !== "admin") return etap1Json({error:"Admin only"},403);
    // Operator panel is watch-only for this demonstration.
    // A manual start used to bypass the session-bound READY admission ledger.
    // Each round requires all three invited roles to explicitly press READY.
    return etap1Json({error:"Only Mitko, Borko and Enchev participate. Every round starts after all three participants set their demo budgets and press READY."},409);
  }

  if (role !== "mitko" && role !== "borko" && role !== "enchev") return etap1Json({error:"Bidder only"},403);
  const nonce=body.nonce;
  const amount=body.amount;
  const expectedSequence=body.expectedSequence;
  if (typeof amount!=="number" || !Number.isSafeInteger(amount) || amount<50 || amount>100000 ||
      typeof expectedSequence!=="number" || !Number.isSafeInteger(expectedSequence) || expectedSequence<0)
    return etap1Json({error:"Valid confirmed absolute offer and sequence required"},400);
  if (typeof nonce !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce))
    return etap1Json({error:"Valid idempotency key required"},400);
  try {
    const result=await etap1Rpc(config,"etap1_bid_offer_secure",{
      p_actor:role,p_session_id:sid,p_nonce:nonce,p_amount:amount,p_expected_sequence:expectedSequence
    }) as {accepted:boolean;duplicate?:boolean;code?:string;state:unknown};
    if(!result.accepted) return etap1Json({
      ok:false,error:result.code??"BID_REJECTED",code:result.code??"BID_REJECTED",state:result.state
    },409);
    return etap1Json({ok:true,duplicate:result.duplicate??false,state:result.state});
  } catch {
    return etap1Json({error:"Bid rejected: round closed or demo service unavailable"},409);
  }
}
