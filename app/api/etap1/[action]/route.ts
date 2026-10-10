import { NextRequest } from "next/server";
import { sameOriginPost } from "../../../lib/enchev-auth-server";
import {
  ETAP1_ROLES, codeValid, clearEtap1Cookie, etap1Body, etap1Config,
  etap1Json, etap1Rpc, issueEtap1Cookie, sessionRole, type Etap1Role,
} from "../../../lib/etap1-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{action:string}> };

export async function GET(request: NextRequest, context: Context) {
  const {action} = await context.params;
  if (action !== "state") return etap1Json({error:"Not found"},404);
  const config = etap1Config();
  if (!config) return etap1Json({available:false, authenticated:false, error:"Pilot not activated"},503);
  const role = sessionRole(request,config);
  if (!role) return etap1Json({available:true,authenticated:false},401);
  try {
    const state = await etap1Rpc(config,"etap1_snapshot");
    return etap1Json({available:true,authenticated:true,role,state});
  } catch {
    return etap1Json({error:"Demo database temporarily unavailable"},503);
  }
}

export async function POST(request: NextRequest, context: Context) {
  if (!sameOriginPost(request)) return etap1Json({error:"Invalid request origin"},403);
  const {action} = await context.params;
  if (!["login","logout","start","bid"].includes(action)) return etap1Json({error:"Not found"},404);
  const config = etap1Config();
  if (!config) return etap1Json({error:"Pilot not activated"},503);

  if (action === "logout") {
    const response=etap1Json({ok:true});
    clearEtap1Cookie(response);
    return response;
  }
  const body=await etap1Body(request);
  if (!body) return etap1Json({error:"Valid JSON request required"},400);

  if (action === "login") {
    const role=body.role;
    const code=body.code;
    if (typeof role !== "string" || !ETAP1_ROLES.includes(role as Etap1Role)
      || typeof code !== "string" || !codeValid(role as Etap1Role,code,config))
      return etap1Json({error:"Invalid demo access code"},401);
    const response=etap1Json({ok:true,role});
    issueEtap1Cookie(response,role as Etap1Role,config);
    return response;
  }

  const role=sessionRole(request,config);
  if (!role) return etap1Json({error:"Session expired. Sign in again."},401);

  if (action === "start") {
    if (role !== "admin") return etap1Json({error:"Admin only"},403);
    const title=body.title;
    const opening=body.openingAmount;
    const increment=body.increment;
    const duration=body.durationSeconds;
    if (typeof title !== "string" || title.trim().length<4 || title.length>120 ||
        typeof opening !== "number" || !Number.isFinite(opening) || opening<100 || opening>10000000 ||
        typeof increment !== "number" || !Number.isFinite(increment) || increment<10 || increment>100000 ||
        !Number.isInteger(duration) || (duration as number)<30 || (duration as number)>600)
      return etap1Json({error:"Invalid demo lot / price / duration"},400);
    try {
      const state=await etap1Rpc(config,"etap1_start",{
        p_title:title.trim(),p_opening_amount:opening,p_increment:increment,p_duration_seconds:duration,
      });
      return etap1Json({ok:true,state});
    } catch {
      return etap1Json({error:"Cannot start auction while another round is active, or provider unavailable"},409);
    }
  }

  if (role !== "mitko" && role !== "borko") return etap1Json({error:"Bidder only"},403);
  const nonce=body.nonce;
  if (typeof nonce !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce))
    return etap1Json({error:"Valid idempotency key required"},400);
  try {
    const state=await etap1Rpc(config,"etap1_bid",{p_actor:role,p_nonce:nonce});
    return etap1Json({ok:true,state});
  } catch {
    return etap1Json({error:"Bid rejected: round closed or demo service unavailable"},409);
  }
}
