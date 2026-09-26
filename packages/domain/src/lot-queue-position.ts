export type LotQueueState = "upcoming" | "live" | "sold" | "unsold" | "cancelled";

export type LotQueueItem = Readonly<{
  auctionId: string;
  lotId: string;
  queueOrder: number;
  state: LotQueueState;
}>;

export type LotQueueIndicator = Readonly<{
  auctionId: string;
  lotId: string;
  queuePosition: number;
  currentLotId: string | null;
  currentQueuePosition: number | null;
  lotsAway: number;
  relation: "current" | "upcoming" | "passed";
}>;

function required(value: string, code: string): string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function actionable(state: LotQueueState): boolean {
  return state==="live"||state==="upcoming";
}

export function lotQueuePositionIndicator(
  rows: readonly LotQueueItem[],
  auctionIdInput: string,
  lotIdInput: string,
  maxQueueItems = 1000,
): LotQueueIndicator {
  const auctionId=required(auctionIdInput,"LOT_QUEUE_AUCTION_REQUIRED");
  const lotId=required(lotIdInput,"LOT_QUEUE_LOT_REQUIRED");
  if(!Number.isInteger(maxQueueItems)||maxQueueItems<1||maxQueueItems>10000) throw new Error("LOT_QUEUE_LIMIT_INVALID");

  const scoped=rows.filter(row=>row.auctionId===auctionId);
  if(scoped.length>maxQueueItems) throw new Error("LOT_QUEUE_LIMIT_EXCEEDED");

  const seenLots=new Set<string>();
  const seenOrders=new Set<number>();
  const normalized=scoped.map(row=>{
    const normalizedAuctionId=required(row.auctionId,"LOT_QUEUE_ROW_AUCTION_REQUIRED");
    const normalizedLotId=required(row.lotId,"LOT_QUEUE_ROW_LOT_REQUIRED");
    if(normalizedAuctionId!==auctionId) throw new Error("LOT_QUEUE_CROSS_AUCTION_ROW");
    if(!Number.isInteger(row.queueOrder)||row.queueOrder<1) throw new Error("LOT_QUEUE_ORDER_INVALID");
    if(seenLots.has(normalizedLotId)) throw new Error("LOT_QUEUE_DUPLICATE_LOT");
    if(seenOrders.has(row.queueOrder)) throw new Error("LOT_QUEUE_DUPLICATE_ORDER");
    seenLots.add(normalizedLotId);
    seenOrders.add(row.queueOrder);
    return Object.freeze({...row,auctionId:normalizedAuctionId,lotId:normalizedLotId});
  }).sort((a,b)=>a.queueOrder-b.queueOrder||a.lotId.localeCompare(b.lotId));

  const target=normalized.find(row=>row.lotId===lotId);
  if(!target) throw new Error("LOT_QUEUE_TARGET_NOT_FOUND");

  const live=normalized.filter(row=>row.state==="live");
  if(live.length>1) throw new Error("LOT_QUEUE_MULTIPLE_LIVE_LOTS");
  const current=live[0]??normalized.find(row=>row.state==="upcoming")??null;

  const targetPassed=!actionable(target.state);
  const relation:LotQueueIndicator["relation"]=targetPassed
    ? "passed"
    : current?.lotId===target.lotId
      ? "current"
      : "upcoming";

  let lotsAway=0;
  if(!targetPassed&&current){
    const actionableQueue=normalized.filter(row=>actionable(row.state));
    const currentIndex=actionableQueue.findIndex(row=>row.lotId===current.lotId);
    const targetIndex=actionableQueue.findIndex(row=>row.lotId===target.lotId);
    lotsAway=targetIndex<=currentIndex?0:targetIndex-currentIndex;
  }

  return Object.freeze({
    auctionId,
    lotId,
    queuePosition:target.queueOrder,
    currentLotId:current?.lotId??null,
    currentQueuePosition:current?.queueOrder??null,
    lotsAway,
    relation,
  });
}
