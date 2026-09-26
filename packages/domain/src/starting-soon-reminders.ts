export type StartingSoonAuction = Readonly<{
  userId: string;
  auctionId: string;
  startsAt: string;
  status: "scheduled" | "live" | "closed" | "cancelled";
}>;

export type StartingSoonReminder = Readonly<{
  userId: string;
  auctionId: string;
  startsAt: string;
  leadMinutes: number;
  dueAt: string;
  reminderKey: string;
}>;

function required(value: string, code: string): string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function instant(value:string, code:string): number {
  const n=Date.parse(value);
  if(!Number.isFinite(n)) throw new Error(code);
  return n;
}

export function startingSoonRemindersForUser(
  rows: readonly StartingSoonAuction[],
  userIdInput: string,
  nowInput: string,
  leadMinutes = 15,
  maxCandidates = 500,
): readonly StartingSoonReminder[] {
  const userId=required(userIdInput,"STARTING_SOON_USER_REQUIRED");
  const nowMs=instant(nowInput,"STARTING_SOON_NOW_INVALID");
  if(!Number.isInteger(leadMinutes)||leadMinutes<1||leadMinutes>1440) throw new Error("STARTING_SOON_LEAD_INVALID");
  if(!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>5000) throw new Error("STARTING_SOON_LIMIT_INVALID");

  const windowEnd=nowMs+leadMinutes*60_000;
  const dedup=new Map<string,StartingSoonReminder>();

  for(const row of rows){
    if(row.userId!==userId||row.status!=="scheduled") continue;
    const auctionId=required(row.auctionId,"STARTING_SOON_AUCTION_REQUIRED");
    const startsMs=instant(row.startsAt,"STARTING_SOON_START_INVALID");
    if(startsMs<nowMs||startsMs>windowEnd) continue;

    const startsAt=new Date(startsMs).toISOString();
    const dueMs=Math.max(nowMs,startsMs-leadMinutes*60_000);
    const reminder=Object.freeze({
      userId,
      auctionId,
      startsAt,
      leadMinutes,
      dueAt:new Date(dueMs).toISOString(),
      reminderKey:`${userId}:${auctionId}:${startsAt}:${leadMinutes}`,
    });
    dedup.set(`${auctionId}:${startsAt}`,reminder);
  }

  return Object.freeze([...dedup.values()]
    .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.auctionId.localeCompare(b.auctionId))
    .slice(0,maxCandidates));
}
