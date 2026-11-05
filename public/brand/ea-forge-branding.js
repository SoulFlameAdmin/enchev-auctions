(()=>{
"use strict";
const brand="E&A East West Auctioneers Group";
const translations=new Map(Object.entries({
 "SKIP TO CONTENT":"КЪМ СЪДЪРЖАНИЕТО",
 "NAVIGATE":"НАВИГАЦИЯ",
 "BUILDS":"АВТОМОБИЛИ",
 "STOCK":"КАТАЛОГ",
 "SITEMAP":"КАРТА НА САЙТА",
 "ORDINARY":"ОБИКНОВЕНОТО",
 "HISTORY GIVES A VEHICLE ITS EXPRESSION. FROM SUBTLE TINTING TO SIGNATURE ILLUMINATION AND REFINED VISUAL DETAILS, WE USE LIGHT TO SHARPEN CHARACTER, PRESENCE AND ATMOSPHERE.":"ИСТОРИЯТА НА АВТОМОБИЛА ПОКАЗВА ВАЖНИТЕ ДЕТАЙЛИ. ПРОВЕРИ ДАННИТЕ, ИЗВЕСТНИТЕ ЩЕТИ И ПРЕДИШНИТЕ СЪБИТИЯ ПРЕДИ ПОКУПКА.",
 "TRANSPORT UPGRADES ARE CHOSEN FOR TONE, RESPONSE AND PRESENCE. NOT NOISE FOR THE SAKE OF NOISE, BUT A SOUND PROFILE THAT GIVES THE VEHICLE MORE CHARACTER AND DEPTH.":"ТРАНСПОРТЪТ СЕ ОРГАНИЗИРА СПОРЕД АВТОМОБИЛА, МАРШРУТА И НУЖДИТЕ ТИ. ПОЛУЧИ ИНФОРМАЦИЯ ЗА ДОСТАВКАТА И СЪОТВЕТНИТЕ ДОКУМЕНТИ.",
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


function key(value){
 return (value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim().toUpperCase();
}
translations.set("NAVIGATE","НАВИГАЦИЯ");
translations.set("NAVIGATION","НАВИГАЦИЯ");
translations.set("EXPLORE MORE","ВИЖ ПОВЕЧЕ");
function creditWithoutLink(){
 const nodes=document.querySelectorAll("footer a, a, footer span, footer small, footer p");
 for(const el of nodes){
  const label=key(el.textContent);
  if(label!=="MADE BY 12 STUDIO" && label!=="SOULFLAME")continue;
  const link=el.closest("a");
  if(link && (label==="MADE BY 12 STUDIO" || link.hasAttribute("data-ea-credit"))){
    link.removeAttribute("href");
    link.removeAttribute("target");
    link.removeAttribute("rel");
    link.removeAttribute("onclick");
    link.tabIndex=-1;
    link.setAttribute("data-ea-credit","");
    link.style.pointerEvents="none";
    link.style.cursor="default";
    link.style.textDecoration="none";
  }
 }
}
function translateSafeText(){
 creditWithoutLink();
 document.documentElement.lang="bg";
 document.title="E&A East West Auctioneers Group | Автомобилни търгове";
 const nodes=document.querySelectorAll("a,button,span,small,strong,p,h1,h2,h3,h4,h5,label,li,figcaption,footer,input,textarea");
 for(const el of nodes){
  if(el.closest("script,style,noscript,[contenteditable=true]"))continue;
  // Only replace actual text leaf nodes. Never clone/remove letter spans,
  // rewrite React-owned structure, or override canvas/scroll elements.
  if(el.childElementCount===0){
   for(const node of el.childNodes){
    if(node.nodeType!==3)continue;
    const content=node.nodeValue||"";
    const trim=content.trim();
    const translated=translations.get(key(trim));
    if(translated && trim && key(trim)!==key(translated)){
      const before=content.slice(0,content.indexOf(trim));
      const after=content.slice(content.indexOf(trim)+trim.length);
      node.nodeValue=before+translated+after;
    }
   }
  }
  for(const attr of ["title","placeholder","aria-label","alt"]){
    const value=el.getAttribute(attr);
    if(!value)continue;
    const translation=translations.get(key(value));
    if(translation && value!==translation)el.setAttribute(attr,translation);
  }
 }
 for(const link of document.querySelectorAll("a")){
   const label=key(link.textContent);
   if((label==="ТЪРГОВЕ НА ЖИВО"||label==="ПОДДРЪЖКА") && parseFloat(getComputedStyle(link).fontSize)>55){
     link.setAttribute("data-ea-bg-large-nav",label==="ТЪРГОВЕ НА ЖИВО"?"live":"support");
   }
 }
}
let timer=null;
function queue(){
 if(timer!==null)return;
 timer=window.setTimeout(()=>{timer=null;translateSafeText();},600);
}
function begin(){
 translateSafeText();
 window.setTimeout(translateSafeText,1700);
 window.setTimeout(translateSafeText,4200);
 // Only new structural nodes trigger work; animation styles/text frames do not.
 const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>m.addedNodes.length>0))queue();
 });
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener("pagehide",()=>{observer.disconnect();if(timer!==null)clearTimeout(timer);},{once:true});
}
if(document.readyState==="complete")window.setTimeout(begin,0);
else {
  window.addEventListener("load",()=>window.setTimeout(begin,100),{once:true});
  document.addEventListener("DOMContentLoaded",()=>window.setTimeout(translateSafeText,1300),{once:true});
}
})();