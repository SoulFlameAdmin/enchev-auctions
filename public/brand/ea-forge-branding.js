(()=>{"use strict";
const brand="E&A East West Auctioneers Group", upper="E&A EAST WEST AUCTIONEERS GROUP";

// Replace the former template studio credit in both the menu and footer.
// Match the smallest wrapper that contains the complete credit, including
// cases where the source splits "Made by" and "12 Studio" across spans.
function applyStudioCredit(){
 const credit=/^MADE\s*BY\s*12\s*STUDIO\.?$/i;
 const nodes=document.querySelectorAll("a,small,span,p,strong,div,footer");
 for(const el of nodes){
  const label=el.textContent?.replace(/\s+/g," ").trim();
  if(!label||!credit.test(label))continue;
  if(Array.from(el.children).some(child=>credit.test(child.textContent?.replace(/\s+/g," ").trim()||"")))continue;
  el.textContent="SOULFLAME";
  if(el.getAttribute("title")?.match(/12\s*STUDIO/i))el.setAttribute("title","SOULFLAME");
  if(el.getAttribute("aria-label")?.match(/12\s*STUDIO/i))el.setAttribute("aria-label","SOULFLAME");
 }
}
function apply(){
 applyStudioCredit();
 document.title="E&A East West Auctioneers Group | Vehicle Auctions";
 for(const el of document.querySelectorAll('a[aria-label="Enchev home"]')) el.setAttribute("aria-label",brand+" home");
 const nodes=document.querySelectorAll('h1,h2,h3,h4,h5,small,strong,span,p,a,button');
 for(const el of nodes){
  if(el.children.length!==0)continue;
  const t=el.textContent?.trim();if(!t||t.length>75)continue;
  if(t==="ENCHEV Auctions"||t==="ENCHEV AUCTIONS"||t==="Enchev Auctions"||t==="ENCHEV")el.textContent=t==="ENCHEV"?upper:brand;
  else if(t==="EAuctions by SOULFLAME"||t==="ENCHEV AUCTIONS × SOULFLAME")el.textContent=brand+"  SOULFLAME";
 }
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
})();