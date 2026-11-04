/* ENCHEV Forge hydration/scroll wake after the separate ad iframe closes.
 * One-shot per request; the native Forge loader owns the actual ENTER.
 * Never recreates the app, resets scroll, or changes animated canvas pixels. */
(() => {
  "use strict";
  let pending=0,lastWake=0,observer=null;
  const intro='[role="dialog"][aria-label="Welcome to ENCHEV Auctions"]';
  function ready(){
    const page=document.querySelector("#page");
    return !!page && !page.hasAttribute("inert") && !document.querySelector(intro);
  }
  function refresh(){
    if(!ready())return false;
    const now=performance.now();
    if(now-lastWake<250)return true;
    lastWake=now;
    // ResizeObserver, Lenis and GSAP ScrollTrigger in the original Forge
    // should observe these native layout/scroll events after the loader fades.
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("scroll"));
    document.dispatchEvent(new Event("visibilitychange"));
    try{window.ScrollTrigger?.refresh?.(true);}catch{}
    try{window.gsap?.core?.globals?.()?.ScrollTrigger?.refresh?.(true);}catch{}
    window.__enchevForgeWake={
      ready:true,at:Date.now(),
      canvasCount:document.querySelectorAll("#page canvas").length,
      scrollTarget:document.scrollingElement?.tagName??null
    };
    return true;
  }
  function handle(event){
    if(event.source!==window.parent||event.origin!==window.location.origin)return;
    if(event.data?.type!=="ENCHEV_FORGE_RESUME")return;
    pending++;
    // Same for 100% watched, skipped at any second, and short ads.
    if(refresh())return;
    // Loader is still fading: observe lifecycle until Forge itself unlocks.
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(!refresh())return;
      observer?.disconnect();
      observer=null;
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["inert","aria-hidden"]});
    setTimeout(()=>{observer?.disconnect();observer=null;refresh();},8000);
  }
  window.addEventListener("message",handle);
})();