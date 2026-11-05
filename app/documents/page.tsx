import "./documents.css";
import BuyerPrivateRecords from "../components/BuyerPrivateRecords";
const items=[
  {n:"01",title:"Buyer identity",copy:"Approved personal or business account, identity verification and eligibility decision before bidding."},
  {n:"02",title:"Vehicle and seller records",copy:"VIN, verified vehicle description, condition disclosures, ownership documents and seller-of-record details."},
  {n:"03",title:"Auction rules",copy:"Accepted bidding terms, fees, deposit and refund policy, reserve rules and finalization conditions."},
  {n:"04",title:"Winning confirmation",copy:"Server-confirmed winner, total price and buyer-linked order. A demo win is never a sales contract."},
  {n:"05",title:"Invoice and payment proof",copy:"Official invoice, payment provider confirmation and reconciliation. No release based solely on a success redirect."},
  {n:"06",title:"Release and transport",copy:"Signed release authorization, pickup code where applicable and transport handover documents."}
];
export default function DocumentsPage(){
 return <main id="main-content" className="eaDocs"><div className="eaDocsWrap">
  <div className="eaDocsKicker">E&A · BUYER DOCUMENT CONTROL</div>
  <h1>DOCUMENTS<br/><em>& RELEASE.</em></h1>
  <p className="eaDocsLead">Your documents will appear here only after a verified account is associated with a real vehicle and an authorized order. We do not fabricate invoices, ownership titles or delivery confirmations.</p>
  <div className="eaDocsStatus" role="status"><strong>Document issuance: not active</strong><span>No live orders or confirmed winners have been registered.</span></div>
  <BuyerPrivateRecords scope="documents"/>
  <div className="eaDocsGrid">{items.map(item=><article key={item.n}><span>{item.n}</span><h2>{item.title}</h2><p>{item.copy}</p><small>Required for live transaction</small></article>)}</div>
  <div className="eaDocsActions"><a href="/start">Buyer journey →</a><a href="/profile">Buyer workspace →</a><a href="/payments">Payments →</a><a href="/transport">Transport →</a></div>
 </div></main>;
}
