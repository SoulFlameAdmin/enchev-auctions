import { NextRequest } from "next/server";
import { etap1Config, etap1Json, etap1Rpc, etap1Session } from "../../../lib/etap1-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "mitko" | "borko" | "enchev" | "krum";
type Presence = { role: string; is_ready: boolean; last_seen: string; session_id: string | null };
type Admission = { role: string; session_id: string };
type Auction = { id: string; currentAmount: number; sequence: number; winnerRole: string | null };
type State = { status: "idle" | "live" | "closed"; serverNow: string; auction: Auction | null; bids: unknown[] };
type LobbyResponse = { state: State; lobby: { count: number; readyCount: number; participants: unknown[] } };
const ROSTER: readonly Role[] = ["mitko","borko","enchev","krum"];

async function readTable<T>(url: string, key: string): Promise<T> {
  const result = await fetch(url, {
    headers: { apikey: key, Authorization: "Bearer " + key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error("Administrative query unavailable");
  return result.json() as Promise<T>;
}

export async function GET(request: NextRequest) {
  const config = etap1Config();
  if (!config) return etap1Json({error:"Demo unavailable"},503);
  const session = etap1Session(request,config);
  if (!session) return etap1Json({error:"Sign in as admin"},401);
  if (session.role !== "admin") return etap1Json({error:"Admin only"},403);
  try {
    // Never trust a browser-supplied role, cookie alone is HMAC authenticated.
    // The service-role credential stays server-side and session IDs never leave the API.
    const base = config.url + "/rest/v1/";
    const [data,presence] = await Promise.all([
      etap1Rpc(config,"etap1_ready_lobby_secure",{p_actor:"admin",p_session_id:session.sid}) as Promise<LobbyResponse>,
      readTable<Presence[]>(base+"enchev_etap1_presence?select=role,is_ready,last_seen,session_id",config.key),
    ]);
    if (!data?.state || !data?.lobby) throw new Error("Invalid monitor state");
    const state = data.state;
    const id = state.status === "live" ? state.auction?.id : null;
    const admissions = id
      ? await readTable<Admission[]>(base+"enchev_etap1_admissions?select=role,session_id&auction_id=eq."+encodeURIComponent(id),config.key)
      : [];
    const now = Date.parse(state.serverNow);
    const participants = ROSTER.map(role=>{
      const member = presence.find(p=>p.role===role);
      const lastSeen = member?.last_seen ?? null;
      const online = Boolean(member?.session_id && lastSeen && Number.isFinite(now)
        && now-Date.parse(lastSeen) >= -5000 && now-Date.parse(lastSeen) <= 15000);
      const inGame = Boolean(online && id && admissions.some(a=>a.role===role && a.session_id===member?.session_id));
      return {role, online, ready:online && Boolean(member?.is_ready), inGame, lastSeen};
    });
    const connected = participants.filter(p=>p.online).length;
    const ready = participants.filter(p=>p.ready).length;
    const inGame = participants.filter(p=>p.inGame).length;
    const required = participants.some(p=>p.role==="krum" && p.online) ? 4 : 3;
    return etap1Json({
      ok:true,serverNow:state.serverNow, status:state.status,auction:state.auction,
      bids:Array.isArray(state.bids)?state.bids:[],
      participants,connected,ready,inGame,required,
      allReady:connected>=required && ready===connected,
    });
  } catch {
    return etap1Json({error:"Admin monitor temporarily unavailable"},503);
  }
}
