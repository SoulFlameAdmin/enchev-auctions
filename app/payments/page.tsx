"use client";

import { useEffect, useState } from "react";
import "./payments.css";

type Readiness = {livePaymentsEnabled:boolean;depositCollectionEnabled:boolean;methods:{id:string;name:string;status:string}[]};

export default function PaymentsPage(){
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const [selected,setSelected]=useState<"stripe"|"revolut">("stripe");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/payments/readiness",{cache:"no-store",signal:controller.signal}).then(r=>r.json())
      .then(setReadiness).catch(()=>{if(!controller.signal.aborted)setReadiness(null)});
    return()=>controller.abort();
  },[]);
  return <main id="main-content" className="eaPay">
    <div className="eaPayInner">
      <div className="eaPayEyebrow">E&A · SECURE BUYER CHECKOUT</div>
      <div className="eaPayIntro">
        <div><h1>DEPOSIT.<br/><em>PAYMENT.</em></h1><p>Every payment starts with an approved buyer, a verified auction and a server-issued payment request. Never transfer funds based on a screenshot or unverified message.</p></div>
        <div className="eaPayFlag" role="status"><span>LIVE MONEY STATUS</span><strong>Not yet enabled</strong><p>Deposits and vehicle payments are blocked until merchant accounts, approved amounts, authentication and financial controls are tested.</p></div>
      </div>

      <section className="eaPayCards" aria-label="Available payment integrations">
        <button type="button" className={selected==="stripe"?"is-chosen":""} aria-pressed={selected==="stripe"} onClick={()=>setSelected("stripe")}>
          <span>01 · CARD CHECKOUT</span><strong>Stripe</strong><small>Visa / Mastercard and eligible cards through hosted checkout.</small><em>{selected==="stripe"?"Selected provider":"View provider"}</em>
        </button>
        <button type="button" className={selected==="revolut"?"is-chosen":""} aria-pressed={selected==="revolut"} onClick={()=>setSelected("revolut")}>
          <span>02 · MERCHANT CHECKOUT</span><strong>Revolut</strong><small>Revolut Merchant checkout after business verification.</small><em>{selected==="revolut"?"Selected provider":"View provider"}</em>
        </button>
      </section>

      <div className="eaPayNotice" role="status">
        <div><span>SELECTED PAYMENT CHANNEL</span><h2>{selected==="stripe"?"Stripe · secure card payment":"Revolut · merchant payment"}</h2><p>{selected==="stripe"?"The future checkout will redirect to Stripe's hosted payment screen for the approved amount. No card number will be entered into E&A.":"The future checkout will use an approved Revolut Business Merchant integration. Personal Revolut transfers are not an accepted substitute."}</p></div>
        <div className="eaPayInactive"><strong>{readiness?.livePaymentsEnabled?"Review payment availability":"Payment not available yet"}</strong><small>No amount is due. This page does not charge your card or create a deposit.</small><a href="/start">Back to buyer journey →</a></div>
      </div>

      <section className="eaPayTwo" id="verification">
        <div><span className="eaPayEyebrow">STEP 02 · ELIGIBILITY</span><h2>Verify before bidding.</h2><p>Account registration, identity/business checks and auction-specific eligibility are required before any refundable bidding deposit can be requested. The deposit amount, refund conditions and payment deadline will be displayed from the official auction rules.</p><a href="/register">Create buyer account →</a><a href="/login">Already registered? Sign in →</a></div>
        <div><span className="eaPayEyebrow">STEP 06 · AFTER WINNING</span><h2>Pay against an invoice.</h2><p>A confirmed winner receives an itemized invoice with the winning bid, buyer fees, taxes and logistics where applicable. Only the verified owner of that invoice can open its checkout. Payment confirmation must come from the provider webhook before release.</p><a href="/documents">Documents and vehicle release →</a><a href="/transport">Transport and pickup →</a></div>
      </section>

      <p className="eaPayFooter">No real-money auction, card payment, Revolut transfer or payout is possible from this page until payment infrastructure and legal approvals are completed.</p>
    </div>
  </main>;
}
