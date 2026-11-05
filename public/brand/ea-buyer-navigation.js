/* E&A buyer destinations in the original cinematic homepage footer.
   Keep native animation, car canvases, menu events and legal links untouched. */
(() => {
  "use strict";
  // The seven actions match the exact buyer process, not arbitrary marketing labels.
  const links = [
    {label:"РЕГИСТРАЦИЯ",href:"/register",primary:true,small:"01 / 07"},
    {label:"ПОТВЪРЖДЕНИЕ И ДЕПОЗИТ",href:"/verification",small:"02 / 07"},
    {label:"ИЗБЕРИ АВТОМОБИЛ",href:"/vehicles",small:"03 / 07"},
    {label:"ТЪРГОВЕ НА ЖИВО",href:"/auctions",small:"04 / 07"},
    {label:"МОИТЕ ТЪРГОВЕ И ПОБЕДИ",href:"/my-auctions",small:"05 / 07"},
    {label:"ПЛАЩАНЕ И ДОКУМЕНТИ",href:"/payments",small:"06 / 07"},
    {label:"ТРАНСПОРТ И ПОЛУЧАВАНЕ",href:"/transport",small:"07 / 07"},
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
      kicker.textContent="E&A · УСЛУГИ ЗА КУПУВАЧИ";
      const title=document.createElement("h2");
      title.id="eaBuyerFooterHeading";
      title.textContent="7 стъпки. Един цялостен процес.";
      const subtitle=document.createElement("p");
      subtitle.textContent="От регистрацията до доставката. Избери стъпка, за да отвориш съответната страница. Входът, документите и плащанията се активират след необходимите проверки.";
      const nav=document.createElement("nav");
      nav.className="eaBuyerFooterNav";
      nav.setAttribute("aria-label","Услуги за купувачи");
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
      disclosure.textContent="Наддаването с реални средства и картовите плащания още не са активни. Предварителната регистрация е достъпна на страницата за купувачи.";
      const secondary=document.createElement("div");
      secondary.className="eaBuyerFooterSecondary";
      for(const item of [{label:"ВХОД",href:"/login"},{label:"ВСИЧКИ 7 СТЪПКИ",href:"/start"},{label:"ДОКУМЕНТИ",href:"/documents"}]){
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