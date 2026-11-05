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
  const link=el.closest("a");
  if(link){
    // Keep the appearance while replacing the hyperlink with plain text.
    const labelNode=document.createElement("span");
    const appearance=getComputedStyle(link);
    labelNode.className=link.className;
    labelNode.style.cssText=link.style.cssText;
    for(const property of ["color","font-family","font-size","font-weight","line-height","letter-spacing","text-transform","display","white-space","opacity","padding","margin"]){
      labelNode.style.setProperty(property,appearance.getPropertyValue(property));
    }
    labelNode.style.cursor="default";
    labelNode.style.textDecoration="none";
    labelNode.textContent="SOULFLAME";
    labelNode.setAttribute("data-soulflame-credit","");
    link.replaceWith(labelNode);
  }else{
    el.textContent="SOULFLAME";
    if(el.getAttribute("title")?.match(/12\s*STUDIO/i))el.setAttribute("title","SOULFLAME");
    if(el.getAttribute("aria-label")?.match(/12\s*STUDIO/i))el.setAttribute("aria-label","SOULFLAME");
  }
 }
}

// Bulgarian copy for the cinematic homepage and its full-screen navigation.
// Official brand names E&A / SOULFLAME are intentionally kept as brands.
const translations=new Map(Object.entries({
 "HOME":"НАЧАЛО",
 "BUY":"КУПИ",
 "LIVE AUCTIONS":"ТЪРГОВЕ НА ЖИВО",
 "SUPPORT":"ПОДДРЪЖКА",
 "CLOSE":"ЗАТВОРИ",
 "OPEN MENU":"ОТВОРИ МЕНЮТО",
 "CLOSE MENU":"ЗАТВОРИ МЕНЮТО",
 "COOKIES":"БИСКВИТКИ",
 "PRIVACY":"ПОВЕРИТЕЛНОСТ",
 "PRIVACY POLICY":"ПОЛИТИКА ЗА ПОВЕРИТЕЛНОСТ",
 "TERMS":"ОБЩИ УСЛОВИЯ",
 "TERMS & CONDITIONS":"ОБЩИ УСЛОВИЯ",
 "POWERED BY":"ТЕХНОЛОГИЯ ОТ",
 "COPYRIGHT © 2026":"© 2026 · ВСИЧКИ ПРАВА ЗАПАЗЕНИ",
 "© 2026":"© 2026",
 "MADE BY 12 STUDIO":"SOULFLAME",
 "REGISTER":"РЕГИСТРАЦИЯ",
 "SIGN IN":"ВХОД",
 "LOG IN":"ВХОД",
 "LOGIN":"ВХОД",
 "PROFILE":"ПРОФИЛ",
 "PAYMENTS":"ПЛАЩАНИЯ",
 "BUY NOW":"КУПИ СЕГА",
 "BID NOW":"НАДДАВАЙ",
 "VEHICLE INVENTORY":"КАТАЛОГ АВТОМОБИЛИ",
 "MY AUCTIONS":"МОИТЕ ТЪРГОВЕ",
 "MY AUCTIONS & WINS":"МОИТЕ ТЪРГОВЕ И ПОБЕДИ",
 "CHECK VEHICLE":"ПРОВЕРИ АВТОМОБИЛ",
 "DOCUMENTS & TRANSPORT":"ДОКУМЕНТИ И ТРАНСПОРТ",
 "ABOUT US":"ЗА НАС",
 "TRANSPORT":"ТРАНСПОРТ",
 "FIND VEHICLES":"НАМЕРИ АВТОМОБИЛИ",
 "CHOOSE VEHICLE":"ИЗБЕРИ АВТОМОБИЛ",
 "CHOOSE A VEHICLE":"ИЗБЕРИ АВТОМОБИЛ",
 "VERIFY & DEPOSIT":"ПОТВЪРЖДЕНИЕ И ДЕПОЗИТ",
 "VERIFICATION & DEPOSIT":"ПОТВЪРЖДЕНИЕ И ДЕПОЗИТ",
 "PAYMENT & DOCUMENTS":"ПЛАЩАНЕ И ДОКУМЕНТИ",
 "TRANSPORT & COLLECTION":"ТРАНСПОРТ И ПОЛУЧАВАНЕ",
 "7 STEPS TO BUY":"7 СТЪПКИ ДО ПОКУПКА",
 "ALL 7 STEPS":"ВСИЧКИ 7 СТЪПКИ",
 "START HERE":"ЗАПОЧНИ ОТТУК",
 "START YOUR PROJECT":"ЗАПОЧНИ",
 "DOCUMENTS":"ДОКУМЕНТИ",
 "IDENTITY":"ИДЕНТИЧНОСТ",
 "INSIGHT":"ИНФОРМАЦИЯ",
 "COHESION":"СВЪРЗАНОСТ",
 "DISCOVERY":"ОТКРИВАНЕ",
 "INSPECTION":"ПРОВЕРКА",
 "AUCTIONS":"ТЪРГОВЕ",
 "HISTORY":"ИСТОРИЯ",
 "SEARCH":"ТЪРСИ",
 "CONTACT":"КОНТАКТИ",
 "REFUSE ORDINARY":"ИЗБЕРИ НЕОБИКНОВЕНОТО",
 "YOUR ROUTE TO YOUR NEXT VEHICLE":"ПЪТЯТ КЪМ СЛЕДВАЩИЯ ТИ АВТОМОБИЛ",
 "EXPLORE INVENTORY":"РАЗГЛЕДАЙ АВТОМОБИЛИТЕ",
 "BROWSE AUCTIONS":"РАЗГЛЕДАЙ ТЪРГОВЕТЕ"
}));
function normalizeText(value){
 return (value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim().toUpperCase();
}
function applyBulgarianInterface(){
 document.documentElement.lang="bg";
 const candidates=document.querySelectorAll("a,button,h1,h2,h3,h4,h5,p,small,strong,span,label,footer");
 for(const el of candidates){
  if(el.closest("script,style,[data-soulflame-credit]"))continue;
  const key=normalizeText(el.textContent);
  const translated=translations.get(key);
  if(translated && key!==normalizeText(translated)){
   if(!el.children.length){
     el.textContent=translated;
   }else{
     // Preserve Forge's animated single-letter span structure when present.
     const children=Array.from(el.children);
     const letterGroup=children.length>1 &&
       children.every(child=>child.tagName==="SPAN" && !child.children.length && child.textContent.length<=2);
     if(letterGroup){
       const template=children[0];
       el.replaceChildren(...Array.from(translated,char=>{
         const span=template.cloneNode(false);
         span.textContent=char===" "?"\u00a0":char;
         return span;
       }));
     }else{
       // Translate only the deepest matching wrapper; avoid flattening icons,
       // nested links, 3D canvases or any functional controls.
       const childMatches=children.some(child=>translations.has(normalizeText(child.textContent)));
       if(!childMatches && children.every(child=>child.nodeType===1 && child.tagName==="SPAN" && !child.querySelector("a,button,svg,img,canvas"))){
         el.textContent=translated;
       }
     }
   }
  }
  for(const attribute of ["aria-label","title","placeholder"]){
    const value=el.getAttribute(attribute);
    if(!value)continue;
    const copy=translations.get(normalizeText(value));
    if(copy && copy!==value)el.setAttribute(attribute,copy);
  }
 }
 // Preserve the meaning of copyright and credits without English boilerplate.
 for(const el of document.querySelectorAll("footer,footer *")){
   if(el.children.length)continue;
   if(/^copyright\s*©?\s*2026$/i.test((el.textContent||"").trim()))el.textContent="© 2026 · ВСИЧКИ ПРАВА ЗАПАЗЕНИ";
 }
}

function apply(){
 applyStudioCredit();
 applyBulgarianInterface();
 document.title="E&A East West Auctioneers Group | Автомобилни търгове";
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