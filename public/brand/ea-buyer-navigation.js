/* E&A buyer destinations in the original cinematic homepage footer.
   Keep native animation, car canvases, menu events and legal links untouched. */
(() => {
  "use strict";
  // The seven actions match the exact buyer process, not arbitrary marketing labels.
  const links = [
    {label:"REGISTER",href:"/register",primary:true,small:"01 / 07"},
    {label:"VERIFICATION & DEPOSIT",href:"/payments#verification",small:"02 / 07"},
    {label:"CHOOSE A VEHICLE",href:"/auctions",small:"03 / 07"},
    {label:"LIVE AUCTIONS",href:"/auctions",small:"04 / 07"},
    {label:"MY AUCTIONS & WINS",href:"/profile#my-auctions",small:"05 / 07"},
    {label:"PAYMENT & DOCUMENTS",href:"/payments",small:"06 / 07"},
    {label:"TRANSPORT & COLLECTION",href:"/transport",small:"07 / 07"},
  ];
  const rootId="ea-buyer-footer-entry-v1";
  function addBuyerFooter(){
    const footer=document.querySelector("footer[data-global-cta]") || document.querySelector("footer.site-nav");
    if(!footer || !footer.parentElement)return;
    let section=document.getElementById(rootId);
    if(section && section.nextElementSibling===footer)return;
    if(!section){
      section=document.createElement("section");
      section.id=rootId;
      section.className="eaBuyerFooter";
      section.setAttribute("aria-labelledby","eaBuyerFooterHeading");
      const kicker=document.createElement("div");
      kicker.className="eaBuyerFooterKicker";
      kicker.textContent="E&A EAST AND WEST · BUYER SERVICES";
      const title=document.createElement("h2");
      title.id="eaBuyerFooterHeading";
      title.textContent="7 steps. One complete journey.";
      const subtitle=document.createElement("p");
      subtitle.textContent="From buyer registration to transport. Select any step to open its dedicated page. Buyer login, document storage and live payments activate after verification.";
      const nav=document.createElement("nav");
      nav.className="eaBuyerFooterNav";
      nav.setAttribute("aria-label","Buyer service destinations");
      links.forEach(item=>{
        const anchor=document.createElement("a");
        anchor.href=item.href;
        anchor.target="_top";
        anchor.className=item.primary?"is-primary":"";
        anchor.setAttribute("aria-label",item.label);
        const sub=document.createElement("small");sub.textContent=item.small;
        const label=document.createElement("strong");label.textContent=item.label;
        const icon=document.createElement("span");icon.textContent="↗";icon.setAttribute("aria-hidden","true");
        anchor.append(sub,label,icon);nav.append(anchor);
      });
      const disclosure=document.createElement("p");
      disclosure.className="eaBuyerFooterNotice";
      disclosure.textContent="Real-money bidding and card payments are not enabled. Early-access registration is available on the buyer journey page.";
      const secondary=document.createElement("div");
      secondary.className="eaBuyerFooterSecondary";
      for(const item of [{label:"SIGN IN",href:"/login"},{label:"ALL 7 STEPS",href:"/start"},{label:"DOCUMENTS",href:"/documents"}]){
        const a=document.createElement("a");a.href=item.href;a.target="_top";a.textContent=item.label+" ↗";secondary.append(a);
      }
      section.append(kicker,title,subtitle,nav,secondary,disclosure);
    }
    footer.parentElement.insertBefore(section,footer);
  }
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",addBuyerFooter,{once:true});}
  else addBuyerFooter();
  const observer=new MutationObserver(addBuyerFooter);
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();