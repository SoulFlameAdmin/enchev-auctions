"use client";

import { usePathname } from "next/navigation";
import "./buyer-journey-rail.css";

const steps = [
  {number:"01",title:"REGISTER",description:"Create buyer profile",url:"/register"},
  {number:"02",title:"VERIFY & DEPOSIT",description:"Eligibility and terms",url:"/verification"},
  {number:"03",title:"CHOOSE VEHICLE",description:"Verified listings",url:"/vehicles"},
  {number:"04",title:"LIVE AUCTION",description:"Bidding schedule",url:"/auctions"},
  {number:"05",title:"MY WINNINGS",description:"Results and orders",url:"/my-auctions"},
  {number:"06",title:"PAY & DOCUMENTS",description:"Invoice and release",url:"/payments"},
  {number:"07",title:"TRANSPORT",description:"Pickup and delivery",url:"/transport"},
] as const;

function selectedStep(path:string){
  if(path.startsWith("/register")||path.startsWith("/login"))return 0;
  if(path.startsWith("/verification"))return 1;
  if(path.startsWith("/vehicles")||path.startsWith("/inventory")||path.startsWith("/lot/"))return 2;
  if(path.startsWith("/auctions"))return 3;
  if(path.startsWith("/my-auctions"))return 4;
  if(path.startsWith("/profile"))return -1;
  if(path.startsWith("/payments")||path.startsWith("/documents"))return 5;
  if(path.startsWith("/transport"))return 6;
  return -1;
}

export default function BuyerJourneyRail(){
  const pathname=usePathname();
  // Marketplace has its own complete navigation; do not append a second giant journey rail.
  if(pathname==="/start" || pathname==="/vehicles" || pathname?.startsWith("/vehicles/") || pathname==="/auctions")return null;
  if(!pathname || ![
    "/start","/register","/login","/verification","/vehicles","/auctions","/inventory","/profile","/my-auctions","/payments",
    "/documents","/transport","/vehicle-history","/support",
   ].some(path=>pathname===path || (path==="/inventory"&&(pathname.startsWith("/lot/")||pathname.startsWith("/vehicles/"))))){
    return null;
  }
  const current=selectedStep(pathname);
  const next=current>=0&&current<steps.length-1?steps[current+1]:null;
  return <footer className="eaBuyerRail" aria-label="Seven step purchase journey">
    <div className="eaBuyerRailTop">
      <div><span className="eaBuyerRailKicker">E&A / BUYER PROCESS</span><h2>One purchase. Seven connected steps.</h2></div>
      <a href="/start">See complete journey ↗</a>
    </div>
    <nav aria-label="Buyer journey steps" className="eaBuyerRailGrid">
      {steps.map((step,i)=><a href={step.url} key={step.number} className={i===current?"is-selected":""} aria-current={i===current?"step":undefined}>
        <small>{step.number} / 07</small>
        <strong>{step.title}</strong>
        <span>{step.description}</span>
      </a>)}
    </nav>
    <div className="eaBuyerRailBottom">
      <p>Demo listings, demo bidding and payment previews are not real-money transactions.</p>
      <div><a href="/login">SIGN IN</a><a href="/documents">DOCUMENTS</a>{next&&<a className="is-next" href={next.url}>NEXT: {next.title} →</a>}</div>
    </div>
  </footer>;
}
