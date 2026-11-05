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

// Every piece of static marketing copy on Home/Index, including adapted
// captions and wording still present in the original cinematic package.
for(const [english,bulgarian] of Object.entries({
 "ENTER":"ВЛЕЗ",
 "ENTER SITE":"ВЛЕЗ В САЙТА",
 "WELCOME TO ENCHEV AUCTIONS":"ДОБРЕ ДОШЛИ В E&A",
 "FOR THOSE WHO REFUSE ORDINARY":"ЗА ТЕЗИ, КОИТО ИЗБИРАТ ПОВЕЧЕ",
 "FOR THOSE WHO":"ЗА ТЕЗИ, КОИТО",
 "REFUSE ORDINARY":"ИЗБИРАТ ПОВЕЧЕ",
 "WE CONNECT YOU WITH VEHICLES":"СВЪРЗВАМЕ ТЕ С АВТОМОБИЛИ",
 "YOU CHOOSE YOUR NEXT ONE":"ТИ ИЗБИРАШ СЛЕДВАЩИЯ",
 "WE DON’T MODIFY VEHICLES":"ПРЕДЛАГАМЕ АВТОМОБИЛИ ОТ ТЪРГОВЕ",
 "WE DON'T MODIFY VEHICLES":"ПРЕДЛАГАМЕ АВТОМОБИЛИ ОТ ТЪРГОВЕ",
 "WE BUILD THEM FOR YOU":"ТИ ИЗБИРАШ СЛЕДВАЩИЯ",
 "AN INTERNATIONAL VEHICLE AUCTION MARKETPLACE FOR DISCOVERY, BIDDING AND DELIVERY.":"МЕЖДУНАРОДНА ПЛАТФОРМА ЗА АВТОМОБИЛНИ ТЪРГОВЕ — ОТ ИЗБОРА И НАДДАВАНЕТО ДО ДОСТАВКАТА.",
 "A LUXURY AUTOMOTIVE ATELIER FOR BESPOKE STYLING, PERFORMANCE AND CRAFTSMANSHIP.":"МЕЖДУНАРОДНИ ТЪРГОВЕ ЗА АВТОМОБИЛИ, ПРОВЕРКА НА ИСТОРИЯТА И ДОСТАВКА ДО ТЕБ.",
 "YOUR ROUTE TO YOUR NEXT VEHICLE":"ПЪТЯТ КЪМ СЛЕДВАЩИЯ ТИ АВТОМОБИЛ",
 "OUR APPROACH TO EVERY BUILD":"ПЪТЯТ КЪМ СЛЕДВАЩИЯ ТИ АВТОМОБИЛ",
 "EVERY DECISION IS INTENTIONAL, EVERY DETAIL HAS PURPOSE BASED ON YOUR TASTE, YOUR LIFESTYLE, AND YOUR STANDARDS.":"ВСЯКО РЕШЕНИЕ Е ВАЖНО. ИЗБИРАЙ С УВЕРЕНОСТ, ПРОВЕРЯВАЙ ДЕТАЙЛИТЕ И НАДДАВАЙ ИНФОРМИРАНО.",
 "EVERY BUILD BEGINS WITH THE PERSON BEHIND THE WHEEL, SHAPED AROUND THEIR INDIVIDUAL TASTE, LIFESTYLE, PRESENCE AND PERSONAL SENSE OF IDENTITY ON THE ROAD.":"ВСИЧКО ЗАПОЧВА С ТЕБ. СЪЗДАЙ ПРОФИЛ, ЗАДАЙ ПРЕДПОЧИТАНИЯТА СИ И ОТКРИЙ АВТОМОБИЛА, КОЙТО ТЪРСИШ.",
 "EXTERIOR, INTERIOR AND PERFORMANCE ARE BROUGHT TOGETHER THROUGH A CONSIDERED, DETAIL-LED APPROACH, CREATING ONE COMPLETE AND FULLY RESOLVED VISION.":"СРАВНЯВАЙ ОБЯВИ, ПРОВЕРЯВАЙ ИСТОРИЯ, СНИМКИ И ДОКУМЕНТИ, ПРЕДИ ДА ВЗЕМЕШ РЕШЕНИЕ.",
 "EVERY MODIFICATION IS CHOSEN WITH PRECISION, ENSURING EACH DETAIL ADDS PURPOSE, BALANCE AND DISTINCTION TO THE FINAL BESPOKE AUTOMOTIVE BUILD.":"РЕГИСТРАЦИЯТА, НАДДАВАНЕТО, ПЛАЩАНЕТО И ТРАНСПОРТЪТ СА СВЪРЗАНИ В ЕДИН ПРОЦЕС.",
 "A VEHICLE SHOULD SAY SOMETHING BEFORE IT MOVES. EVERY LINE, MATERIAL, AND FINISH IS CONSIDERED.":"ИЗБЕРИ АВТОМОБИЛ С УВЕРЕНОСТ. ВСЕКИ ДЕТАЙЛ Е ОТ ЗНАЧЕНИЕ.",
 "OUR SERVICES ARE SHAPED WITH INTENT, FROM EXTERIOR STYLING AND INTERIOR REFINEMENT TO PERFORMANCE UPGRADES, DETAILING AND BESPOKE FINISHES; EACH DETAIL SHARPENS THE VEHICLE’S CHARACTER WITHOUT OVERPOWERING IT.":"ОТ ПЪРВАТА ПРОВЕРКА НА АВТОМОБИЛА ДО КРАЙНАТА ДОСТАВКА — ИНФОРМАЦИЯТА, ТЪРГЪТ, ДОКУМЕНТИТЕ И ТРАНСПОРТЪТ СА НА ЕДНО МЯСТО.",
 "SERVICE":"УСЛУГА",
 "OUR SERVICES":"НАШИТЕ УСЛУГИ",
 "BODYSTYLING":"ТЪРСЕНЕ НА АВТОМОБИЛИ",
 "INTERIOR":"ПРОВЕРКА",
 "WHEELS":"ТЪРГОВЕ",
 "LIGHTING":"ИСТОРИЯ НА АВТОМОБИЛА",
 "EXHAUST":"ТРАНСПОРТ",
 "PROTECTION":"ПОДДРЪЖКА",
 "FROM AERO STYLING TO CARBON DETAILS AND EXTERIOR REFINEMENT, BODYWORK IS DESIGNED TO CHANGE THE VEHICLE’S PRESENCE WITHOUT COMPROMISING ITS ORIGINAL CHARACTER.":"РАЗГЛЕЖДАЙ АВТОМОБИЛИ, СНИМКИ И ДАННИ ЗА ЛОТОВЕТЕ, ЗА ДА ОТКРИЕШ ПОДХОДЯЩИЯ ИЗБОР.",
 "MATERIAL, STITCHING, TRIM AND FINISH ARE SELECTED TO CREATE AN INTERIOR THAT FEELS PERSONAL, TACTILE AND COMPOSED. WE TURN THE CABIN INTO A SPACE OF IDENTITY, COMFORT AND CONTROL.":"ПРОВЕРИ ИСТОРИЯТА, ПРОБЕГА, СЪСТОЯНИЕТО И ДОКУМЕНТИТЕ НА АВТОМОБИЛА, ПРЕДИ ДА НАДДАВАШ.",
 "BESPOKE WHEEL UPGRADES DESIGNED TO ENHANCE STANCE, PROPORTION AND ROAD PRESENCE, WITH FITMENTS SELECTED TO COMPLEMENT THE VEHICLE’S CHARACTER AND PERFORMANCE.":"УЧАСТВАЙ В ТЪРГОВЕ НА ЖИВО, СЛЕДИ СТАВКИТЕ И ПОЛУЧАВАЙ АКТУАЛЕН СТАТУС НА ЛОТОВЕТЕ.",
 "LIGHTING GIVES A VEHICLE ITS EXPRESSION. FROM SUBTLE TINTING TO SIGNATURE ILLUMINATION AND REFINED VISUAL DETAILS, WE USE LIGHT TO SHARPEN CHARACTER, PRESENCE AND ATMOSPHERE.":"ПРОВЕРЯВАЙ ВАЖНИТЕ ДАННИ ЗА АВТОМОБИЛА И ИЗВЕСТНИТЕ СЪБИТИЯ ОТ НЕГОВАТА ИСТОРИЯ.",
 "EXHAUST UPGRADES ARE CHOSEN FOR TONE, RESPONSE AND PRESENCE. NOT NOISE FOR THE SAKE OF NOISE, BUT A SOUND PROFILE THAT GIVES THE VEHICLE MORE CHARACTER AND DEPTH.":"ПЛАНИРАЙ ПРЕВОЗА НА ЗАКУПЕНИЯ АВТОМОБИЛ — ОТ АУКЦИОННАТА ПЛОЩАДКА ДО АДРЕСА ЗА ДОСТАВКА.",
 "PAINT PROTECTIVE FILM SOLUTIONS THAT PRESERVE THE FINISH OF THE VEHICLE WHILE ALLOWING FOR SATIN FINISHES, COLOURED FILMS AND FULL VISUAL TRANSFORMATION.":"ПОЛУЧИ СЪДЕЙСТВИЕ ЗА РЕГИСТРАЦИЯТА, УЧАСТИЕТО В ТЪРГ И СЛЕДВАЩИТЕ СТЪПКИ.",
 "ENDS HERE":"СВЪРШВА ТУК",
 "ORDINARY ENDS HERE":"ОБИКНОВЕНОТО СВЪРШВА ТУК",
 "COMPLETE EXPRESSIONS OF TASTE, INTENT AND INDIVIDUALITY, SHAPED THROUGH DETAIL, RESTRAINT AND PRESENCE.":"ПОВЕЧЕ ВЪЗМОЖНОСТИ ЗА ПОКУПКА НА АВТОМОБИЛ — С ЯСНИ СТЪПКИ И ПРОЗРАЧНА ИНФОРМАЦИЯ.",
 "PREVIOUS BUILDS":"КАТАЛОГ АВТОМОБИЛИ",
 "VEHICLE INVENTORY":"КАТАЛОГ АВТОМОБИЛИ",
 "A COLLECTION OF PREVIOUS BESPOKE BUILDS, SHAPED BY CRAFT, CHARACTER AND THE PEOPLE BEHIND THE WHEEL.":"РАЗГЛЕДАЙ НАЛИЧНИТЕ АВТОМОБИЛИ И НАМЕРИ ПОДХОДЯЩАТА ВЪЗМОЖНОСТ ЗА ПОКУПКА.",
 "AVAILABLE STOCK":"ТЪРГОВЕ НА ЖИВО",
 "BUILDS AVAILABLE FOR PURCHASE, REFINED WITH INTENT, ENGINEERED WITH PURPOSE, AND READY TO MAKE A STATEMENT.":"ОТКРИЙ АВТОМОБИЛИ, ПРЕДСТОЯЩИ ТЪРГОВЕ И ВЪЗМОЖНОСТИ ЗА НАДДАВАНЕ.",
 "EXPLORE BUILDS":"РАЗГЛЕДАЙ АВТОМОБИЛИТЕ",
 "BROWSE STOCK":"РАЗГЛЕДАЙ ТЪРГОВЕТЕ",
 "ARE YOU READY TO":"ГОТОВ ЛИ СИ ДА",
 "VEHICLE AUCTIONS WITH INVENTORY, LIVE BIDDING, VEHICLE HISTORY AND TRANSPORT IN ONE PLACE.":"АВТОМОБИЛНИ ТЪРГОВЕ, ПРОВЕРКА НА ИСТОРИЯТА, НАДДАВАНЕ И ТРАНСПОРТ — ВСИЧКО НА ЕДНО МЯСТО.",
 "BESPOKE VEHICLES BUILT ON DISTINCTION, DESIRE, AND IDENTITY. NOT SIMPLY TO BE MODIFIED.":"АВТОМОБИЛНИ ТЪРГОВЕ, ПРОВЕРКА НА ИСТОРИЯТА, НАДДАВАНЕ И ТРАНСПОРТ — ВСИЧКО НА ЕДНО МЯСТО.",
 "VIEW INVENTORY":"РАЗГЛЕДАЙ КАТАЛОГА",
 "EXPLORE OUR VEHICLES":"РАЗГЛЕДАЙ АВТОМОБИЛИТЕ",
 "VIEW ALL":"ВИЖ ВСИЧКИ",
 "BACK":"НАЗАД",
 "NEXT":"НАПРЕД",
 "PREVIOUS":"ПРЕДИШЕН",
 "LOADING":"ЗАРЕЖДАНЕ",
 "SKIP":"ПРОПУСНИ",
 "SCROLL TO EXPLORE":"ПРЕВЪРТИ, ЗА ДА РАЗГЛЕДАШ",
 "SCROLL TO DISCOVER":"ПРЕВЪРТИ, ЗА ДА ОТКРИЕШ",
 "EST. 2026":"ОСНОВАНА ПРЕЗ 2026 Г.",
 "COPYRIGHT 2026":"© 2026 · ВСИЧКИ ПРАВА ЗАПАЗЕНИ",
 "COPYRIGHT © 2026":"© 2026 · ВСИЧКИ ПРАВА ЗАПАЗЕНИ",
 "MADE BY 12 STUDIO":"SOULFLAME",
 "POWERED BY WRPD.":"РАЗРАБОТЕНО ОТ SOULFLAME",
 "POWERED BY WRPD":"РАЗРАБОТЕНО ОТ SOULFLAME"
}))translations.set(english,bulgarian);

function normalizeText(value){
 return (value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim().toUpperCase();
}
function applyBulgarianInterface(){
 document.documentElement.lang="bg";
 const candidates=document.querySelectorAll("a,button,h1,h2,h3,h4,h5,p,small,strong,span,label,footer,input,textarea,figcaption,li,[data-sanity]");
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
  for(const attribute of ["aria-label","title","placeholder","alt"]){
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