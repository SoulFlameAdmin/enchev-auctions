export type BuyerAuctionId = string;
export type BuyerUserId = string;

export type BuyerAuctionParticipation = Readonly<{
  userId: BuyerUserId;
  auctionId: BuyerAuctionId;
  hasAcceptedBid: boolean;
  isCurrentLeader: boolean;
  auctionStatus: "scheduled" | "live" | "closed" | "cancelled";
  updatedAt: string;
}>;

export type MultiAuctionPanelItem = Readonly<{
  auctionId: BuyerAuctionId;
  status: "scheduled" | "live" | "closed" | "cancelled";
  actionState: "watch" | "bid" | "leading" | "ended";
  sequence: number;
  stale: boolean;
}>;

export type AuctionCalendarEntry = Readonly<{
  auctionId: BuyerAuctionId;
  startsAt: string;
  endsAt: string | null;
  title: string;
  status: "scheduled" | "live" | "closed" | "cancelled";
}>;

function required(value: string, code: string): string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function validDate(value:string, code:string): number {
  const n=Date.parse(value);
  if(!Number.isFinite(n)) throw new Error(code);
  return n;
}

export function biddingAuctionsForUser(
  rows: readonly BuyerAuctionParticipation[],
  userIdInput: BuyerUserId,
): readonly BuyerAuctionId[] {
  const userId=required(userIdInput,"BIDDING_USER_REQUIRED");
  return Object.freeze([...new Set(rows
    .filter(x=>x.userId===userId&&x.hasAcceptedBid&&x.auctionStatus!=="closed"&&x.auctionStatus!=="cancelled")
    .map(x=>required(x.auctionId,"BIDDING_AUCTION_REQUIRED")))].sort());
}

export function leadingAuctionsForUser(
  rows: readonly BuyerAuctionParticipation[],
  userIdInput: BuyerUserId,
): readonly BuyerAuctionId[] {
  const userId=required(userIdInput,"LEADING_USER_REQUIRED");
  return Object.freeze([...new Set(rows
    .filter(x=>x.userId===userId&&x.hasAcceptedBid&&x.isCurrentLeader&&x.auctionStatus==="live")
    .map(x=>required(x.auctionId,"LEADING_AUCTION_REQUIRED")))].sort());
}

export function endedAuctionsForUser(
  rows: readonly BuyerAuctionParticipation[],
  userIdInput: BuyerUserId,
): readonly BuyerAuctionId[] {
  const userId=required(userIdInput,"ENDED_USER_REQUIRED");
  return Object.freeze([...new Set(rows
    .filter(x=>x.userId===userId&&x.hasAcceptedBid&&x.auctionStatus==="closed")
    .map(x=>required(x.auctionId,"ENDED_AUCTION_REQUIRED")))].sort());
}

export function buildMultiAuctionPanel(
  rows: readonly BuyerAuctionParticipation[],
  userIdInput: BuyerUserId,
  sequences: Readonly<Record<string, number>>,
  staleAuctionIds: readonly string[] = [],
  maxAuctions = 12,
): readonly MultiAuctionPanelItem[] {
  const userId=required(userIdInput,"PANEL_USER_REQUIRED");
  if(!Number.isInteger(maxAuctions)||maxAuctions<1||maxAuctions>100) throw new Error("PANEL_LIMIT_INVALID");
  const stale=new Set(staleAuctionIds);
  const mine=rows.filter(x=>x.userId===userId);
  const byAuction=new Map<string,BuyerAuctionParticipation>();
  for(const row of mine){
    const id=required(row.auctionId,"PANEL_AUCTION_REQUIRED");
    const prev=byAuction.get(id);
    if(!prev||Date.parse(row.updatedAt)>=Date.parse(prev.updatedAt)) byAuction.set(id,row);
  }
  return Object.freeze([...byAuction.values()]
    .map(row=>{
      const sequence=sequences[row.auctionId];
      if(!Number.isInteger(sequence)||sequence<0) throw new Error("PANEL_SEQUENCE_INVALID");
      const actionState:MultiAuctionPanelItem["actionState"]=
        row.auctionStatus==="closed"||row.auctionStatus==="cancelled" ? "ended" :
        row.isCurrentLeader&&row.hasAcceptedBid ? "leading" :
        row.hasAcceptedBid ? "bid" : "watch";
      return Object.freeze({
        auctionId:row.auctionId,
        status:row.auctionStatus,
        actionState,
        sequence,
        stale:stale.has(row.auctionId),
      });
    })
    .sort((a,b)=>a.auctionId.localeCompare(b.auctionId))
    .slice(0,maxAuctions));
}

export function auctionCalendar(
  entries: readonly AuctionCalendarEntry[],
  maxEntries = 500,
): readonly AuctionCalendarEntry[] {
  if(!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>5000) throw new Error("CALENDAR_LIMIT_INVALID");
  const normalized=entries.map(entry=>{
    const auctionId=required(entry.auctionId,"CALENDAR_AUCTION_REQUIRED");
    const title=required(entry.title,"CALENDAR_TITLE_REQUIRED");
    const start=validDate(entry.startsAt,"CALENDAR_START_INVALID");
    if(entry.endsAt!==null){
      const end=validDate(entry.endsAt,"CALENDAR_END_INVALID");
      if(end<start) throw new Error("CALENDAR_INTERVAL_INVALID");
    }
    return Object.freeze({...entry,auctionId,title});
  });
  const dedup=new Map<string,AuctionCalendarEntry>();
  for(const entry of normalized){
    const prev=dedup.get(entry.auctionId);
    if(!prev||Date.parse(entry.startsAt)>=Date.parse(prev.startsAt)) dedup.set(entry.auctionId,entry);
  }
  return Object.freeze([...dedup.values()]
    .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.auctionId.localeCompare(b.auctionId))
    .slice(0,maxEntries));
}
