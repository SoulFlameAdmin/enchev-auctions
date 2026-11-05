/* E&A buyer destinations in the original cinematic homepage footer.
   Keep native animation, car canvases, menu events and legal links untouched. */
(() => {
  "use strict";
  const links = [
    {label:"BUYER JOURNEY",href:"/start",primary:true,small:"7 STEPS"},
    {label:"REGISTER",href:"/register",small:"ACCOUNT"},
    {label:"SIGN IN",href:"/login",small:"ACCOUNT"},
    {label:"AUCTIONS",href:"/auctions",small:"VEHICLES"},
    {label:"DEPOSIT & PAYMENTS",href:"/payments",small:"STRIPE / REVOLUT"},
    {label:"DOCUMENTS",href:"/documents",small:"AFTER WINNING"},
    {label:"TRANSPORT",href:"/transport",small:"COLLECTION"},
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
      title.textContent="Your journey begins here.";
      const subtitle=document.createElement("p");
      subtitle.textContent="Register, explore verified vehicles, arrange payments and prepare delivery — all from one place.";
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
      section.append(kicker,title,subtitle,nav,disclosure);
    }
    footer.parentElement.insertBefore(section,footer);
  }
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",addBuyerFooter,{once:true});}
  else addBuyerFooter();
  const observer=new MutationObserver(addBuyerFooter);
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();