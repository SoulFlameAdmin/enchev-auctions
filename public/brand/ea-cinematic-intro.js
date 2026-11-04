/* Only the ENTER splash. Never hijack native ENTER, Forge/GSAP scroll, or advert logic. */
(() => {
  "use strict";
  const selector='[role="dialog"][aria-label="Welcome to ENCHEV Auctions"]';
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let current=null, base=null, samples=0, sumBeta=0, sumGamma=0;
  let x=0,y=0,tx=0,ty=0,raf=0,last=0,scheduled=false, gsapRequested=false;
  const clamp=(v,max)=>Math.max(-max,Math.min(max,v));
  const canMove=()=>!reduced?.matches && !!current;
  function render(time){
    raf=0;if(!canMove())return;
    if(time-last<16){raf=requestAnimationFrame(render);return;}last=time;
    x+=(tx-x)*.15;y+=(ty-y)*.15;
    current.style.setProperty("--ea-parallax-x",x.toFixed(2)+"px");
    current.style.setProperty("--ea-parallax-y",y.toFixed(2)+"px");
    if(Math.abs(tx-x)+Math.abs(ty-y)>.2)raf=requestAnimationFrame(render);
  }
  function paint(){if(!raf&&canMove())raf=requestAnimationFrame(render);}
  function orientation(event){
    if(!canMove()||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
    // Establish a zero-point for each new viewing session without storing sensor data.
    if(!base){
      sumBeta+=event.beta;sumGamma+=event.gamma;samples++;
      if(samples<9)return;
      base={beta:sumBeta/samples,gamma:sumGamma/samples};
    }
    tx=clamp((event.gamma-base.gamma)*.45,9);
    ty=clamp((event.beta-base.beta)*.25,9);
    paint();
  }
  function pointer(event){
    if(!canMove()||!window.matchMedia("(pointer:fine)").matches)return;
    tx=clamp((event.clientX/window.innerWidth-.5)*12,6);
    ty=clamp((event.clientY/window.innerHeight-.5)*10,5);
    paint();
  }
  function parentLogo(on){
    try{
      if(window.parent!==window && window.parent.location.origin===location.origin){
        window.parent.document.documentElement.classList.toggle("ea-intro-redwhite",on);
      }
    }catch{/* embedded elsewhere: no cross-origin access */}
  }
  function animate(){
    if(!current||reduced?.matches)return;
    const gsap=window.gsap;
    if(gsap?.fromTo){
      gsap.fromTo(current,{"--ea-shine":0.2},{"--ea-shine":1,duration:1.45,ease:"power2.out",overwrite:true});
    }else if(!gsapRequested){
      // GSAP is optional; the CSS design and native Forge entry work offline.
      gsapRequested=true;
      const script=document.createElement("script");
      script.src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      script.async=true;script.referrerPolicy="no-referrer";
      script.onload=()=>{if(current)animate();};
      document.head.appendChild(script);
    }
  }
  function markEnter(dialog){
    for(const element of dialog.querySelectorAll("button,a,[role=button]")){
      const value=(element.textContent||element.getAttribute("aria-label")||"").replace(/\s+/g," ").trim();
      if(/^ENTER(?:\s*[→↗›])?$/i.test(value))element.setAttribute("data-ea-intro-enter","");
    }
  }
  function scan(){
    scheduled=false;
    const candidate=document.querySelector(selector);
    const visible=candidate&&!candidate.closest("[hidden]")&&candidate.getClientRects().length>0;
    const next=visible?candidate:null;
    if(next!==current){
      if(raf)cancelAnimationFrame(raf);
      raf=0;current=next;base=null;samples=0;sumBeta=0;sumGamma=0;
      x=y=tx=ty=0;parentLogo(!!current);
      if(current)animate();
    }
    if(current)markEnter(current);
  }
  function schedule(){
    if(scheduled)return;scheduled=true;requestAnimationFrame(scan);
  }
  window.addEventListener("deviceorientation",orientation,{passive:true});
  window.addEventListener("pointermove",pointer,{passive:true});
  window.addEventListener("pagehide",()=>{parentLogo(false);current=null;if(raf)cancelAnimationFrame(raf);});
  const watcher=new MutationObserver(schedule);
  function start(){
    if(!document.body){document.addEventListener("DOMContentLoaded",start,{once:true});return;}
    watcher.observe(document.body,{childList:true,subtree:true});
    scan();
  }
  start();
})();
