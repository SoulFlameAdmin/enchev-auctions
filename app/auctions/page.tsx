"use client";

import { useState } from "react";
import "./auctions.css";

type AuctionTab = "live" | "upcoming" | "ended";
const tabs: ReadonlyArray<{id:AuctionTab,label:string,description:string}> = [
  {id:"live",label:"LIVE NOW",description:"Auctions currently accepting verified bids."},
  {id:"upcoming",label:"UPCOMING",description:"Verified vehicles scheduled for a future auction."},
  {id:"ended",label:"RESULTS",description:"Finalized sales with approved public results."},
];

const buyerSteps = [
  {index:"01",title:"Explore vehicles",description:"Review real photos, VIN details, condition, documents and seller disclosures."},
  {index:"02",title:"Create an account",description:"Register as a private or business buyer and confirm your email."},
  {index:"03",title:"Become eligible",description:"Complete identity checks and the auction-specific participation requirements."},
  {index:"04",title:"Bid in real time",description:"Once activated, follow the authoritative server timer and confirmed bids."},
  {index:"05",title:"Win and collect",description:"Receive the actual invoice, payment instructions and transport or pickup options."},
] as const;

export default function AuctionsPage() {
  const [tab,setTab] = useState<AuctionTab>("live");
  const selection = tabs.find(item=>item.id===tab)!;

  return (
    <main id="main-content" className="eaRealAuctions">
      <div className="eaRealAuctionsInner">
        <div className="eaRealKicker"><span className="eaRealDot"/> E&A EAST AND WEST · AUCTION MARKETPLACE</div>
        <div className="eaRealHeading">
          <div>
            <h1>REAL <em>AUCTIONS.</em></h1>
            <p>Find verified vehicles. Follow the sale. Bid when your account and the auction have been approved for live participation.</p>
          </div>
          <div className="eaRealStatus" role="status"><span>PRODUCTION MARKETPLACE</span><strong>Awaiting verified live inventory</strong><small>Demo vehicles and test bids are not published as real sales.</small></div>
        </div>
        <div className="eaRealTabs" role="tablist" aria-label="Auction status">
          {tabs.map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} aria-controls="ea-real-lot-panel" onClick={()=>setTab(item.id)} className={tab===item.id?"is-active":""}>{item.label}</button>)}
        </div>
        <section id="ea-real-lot-panel" className="eaRealEmpty" role="tabpanel" aria-label={selection.label}>
          <div className="eaRealEmptyVisual" aria-hidden="true"><div className="eaRealEmptyRing"><span>EA</span></div></div>
          <div className="eaRealEmptyCopy">
            <span className="eaRealEyebrow">VERIFIED INVENTORY ONLY</span>
            <h2>{tab==="live"?"No live auctions published":tab==="upcoming"?"No scheduled auctions published":"No verified results published"}</h2>
            <p>{selection.description} Only seller-authorized, reviewed vehicle listings will appear here. The current test auctions remain separate.</p>
            <div className="eaRealActions">
              <a className="eaRealPrimary" href="/register">Buyer registration <span aria-hidden="true">→</span></a>
              <a className="eaRealSecondary" href="/support">Contact the auction team <span aria-hidden="true">↗</span></a>
            </div>
            <p className="eaRealAccountNote">Registration may be unavailable until identity-provider activation is complete. No real-money bids or payments are accepted on this page.</p>
          </div>
        </section>
        <section className="eaRealHow" aria-labelledby="ea-real-how-title">
          <div className="eaRealSectionHead"><span>YOUR NEXT STEPS</span><h2 id="ea-real-how-title">From browsing to delivery.</h2></div>
          <div className="eaRealSteps">{buyerSteps.map(s=><article key={s.index}><span>{s.index}</span><h3>{s.title}</h3><p>{s.description}</p></article>)}</div>
        </section>
        <div className="eaRealDemo">
          <div><strong>Want to try the bidding experience?</strong><p>The interactive auction room currently runs as a clearly marked demo with illustrative vehicles, prices and results.</p></div>
          <a href="/live-auctions">OPEN DEMO ROOM →</a>
        </div>
      </div>
    </main>
  );
}
