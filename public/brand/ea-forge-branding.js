(()=>{"use strict";
const brand="E&A East West Auctioneers Group", upper="E&A EAST WEST AUCTIONEERS GROUP";
function apply(){
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