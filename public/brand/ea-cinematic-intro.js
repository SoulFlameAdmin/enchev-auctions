/* QUANTUM LIQUID TILT — Forge opening splash only.
   Locally calibrated motion, full red/white immersion. No interaction hijacking. */
(() => {
  "use strict";
  const selector='[role="dialog"][aria-label="Welcome to ENCHEV Auctions"]';
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const finePointer=window.matchMedia?.("(pointer:fine)");
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Screenshot-calibrated extremes (694px x 1276px reference viewport):
  // white-heavy: red starts at right edge ~38.5% down and bottom ~38.5% across;
  // red-heavy: red starts at top ~51% across and left edge ~51% down.
  // 0 = neutral diagonal. Both colors must ALWAYS remain visible.
  const MIN_LIQUID=-0.385; // maximum white, k=1.385
  const MAX_LIQUID=0.49;   // maximum red,   k=0.51
  let current=null,base=null,n=0,betaSum=0,gammaSum=0;
  let target=0,liquid=0,velocity=0,phase=0,raf=0,last=0,scheduled=false;
  let sensorSeen=false,permissionAsked=false,gsapRequested=false,logoRed=false;
  const pace=1000/35;

  function parentLogo(active,red=false) {
    try{
      if(window.parent!==window && window.parent.location.origin===location.origin){
        const root=window.parent.document.documentElement;
        root.classList.toggle("ea-intro-redwhite",active);
        root.classList.toggle("ea-intro-red-cover",active&&red);
      }
    }catch{/* same-origin only */}
  }
  const px=p=>p.x.toFixed(1)+"px "+p.y.toFixed(1)+"px";
  function draw(amount,speed) {
    if(!current)return;
    const w=current.clientWidth||window.innerWidth,h=current.clientHeight||window.innerHeight;
    if(w<1||h<1)return;
    const k=clamp(1-amount,1-MAX_LIQUID,1-MIN_LIQUID);
    // Only the two photographed limits are allowed (never all red/white).
    const a=k<=1?{x:k*w,y:0}:{x:w,y:(k-1)*h};
    const b=k<=1?{x:0,y:k*h}:{x:(k-1)*w,y:h};
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    const nx=length?dy/length:0,ny=length?-dx/length:0;
    const amp=clamp(1.2+Math.abs(speed)*110,1.2,8),wave=[];
    for(let i=0;i<=12;i++){
      const t=i/12;
      const ripple=length>1?Math.sin(Math.PI*t)*Math.sin(3.2*Math.PI*t+phase)*amp:0;
      wave.push({x:a.x+dx*t+nx*ripple,y:a.y+dy*t+ny*ripple});
    }
    const corners=k<=1
      ?[a,{x:w,y:0},{x:w,y:h},{x:0,y:h},b]
      :[a,{x:w,y:h},b];
    const red=[...corners,...wave.slice(1,-1).reverse()];
    const half=1.4;
    const near=wave.map(p=>px({x:p.x+nx*half,y:p.y+ny*half}));
    const far=wave.slice().reverse().map(p=>px({x:p.x-nx*half,y:p.y-ny*half}));
    current.style.setProperty("--ea-liquid-red-clip","polygon("+red.map(px).join(",")+")");
    current.style.setProperty("--ea-liquid-edge-clip",length<2
      ?"polygon(0px 0px,0px 0px,0px 0px)"
      :"polygon("+near.concat(far).join(",")+")");
    current.style.setProperty("--ea-text-cut",clamp((k-.5)*100,0,100).toFixed(1)+"%");
    const enterRed=k<1.33;
    current.style.setProperty("--ea-enter-color",enterRed?"#fff":"#15171c");
    current.style.setProperty("--ea-enter-shadow",enterRed
      ?"0 2px 12px rgba(62,0,7,.35)":"0 2px 9px rgba(255,255,255,.6)");
    const redAtLogo=k<.59;
    if(logoRed!==redAtLogo){logoRed=redAtLogo;parentLogo(true,redAtLogo);}
    current.style.setProperty("--ea-parallax-x",(amount*6).toFixed(1)+"px");
    current.style.setProperty("--ea-parallax-y",(amount*4).toFixed(1)+"px");
  }
  function step(now) {
    raf=0;
    if(!current||reduced?.matches||document.hidden)return;
    if(now-last<pace){raf=requestAnimationFrame(step);return;}
    last=now;
    velocity=(velocity+(target-liquid)*.047)*.84;
    liquid+=velocity;
    // Hard-stop the spring at BOTH screenshot edges: no overshoot on fast tilts.
    if(liquid<=MIN_LIQUID){liquid=MIN_LIQUID;if(velocity<0)velocity=0;}
    if(liquid>=MAX_LIQUID){liquid=MAX_LIQUID;if(velocity>0)velocity=0;}
    phase+=Math.min(.3,Math.abs(velocity)*7);
    const settled=Math.abs(target-liquid)<.0006&&Math.abs(velocity)<.0005;
    if(settled){liquid=target;velocity=0;}
    draw(liquid,velocity);
    if(!settled)raf=requestAnimationFrame(step);
  }
  function paint() {
    if(current&&!reduced?.matches&&!raf&&!document.hidden)raf=requestAnimationFrame(step);
  }
  function orientation(e) {
    if(!current||reduced?.matches||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
    sensorSeen=true;
    if(!base){
      betaSum+=e.beta;gammaSum+=e.gamma;n++;
      if(n<9)return;
      base={beta:betaSum/n,gamma:gammaSum/n};
    }
    let gamma=e.gamma-base.gamma,beta=e.beta-base.beta;
    const angle=window.screen.orientation?.angle??0;
    if(angle===90||angle===270){
      const sign=angle===90?1:-1,rotated=sign*beta;
      beta=-sign*gamma;gamma=rotated;
    }
    // Upper-left (negative) => more white; down-right (positive) => more red.
    target=clamp((gamma*.68+beta*.32)/29,MIN_LIQUID,MAX_LIQUID);
    paint();
  }
  function pointer(e) {
    // Desktop preview: bottom-right cursor simulates the down-right phone tilt.
    if(!current||sensorSeen||reduced?.matches||!finePointer?.matches)return;
    const dx=e.clientX/window.innerWidth-.5,dy=e.clientY/window.innerHeight-.5;
    target=clamp((dx*.62+dy*.38)*2,MIN_LIQUID,MAX_LIQUID);
    paint();
  }
  function requestMotion() {
    if(!current||permissionAsked)return;
    const ctor=window.DeviceOrientationEvent;
    if(typeof ctor?.requestPermission!=="function")return;
    permissionAsked=true;
    // On iOS this must run inside a real tap. No native click is cancelled.
    try{ctor.requestPermission().catch(()=>{});}catch{/* unavailable */}
  }
  function markEnter(dialog) {
    for(const el of dialog.querySelectorAll("button,a,[role=button]")){
      const label=(el.textContent||el.getAttribute("aria-label")||"").replace(/\s+/g," ").trim();
      if(/^ENTER(?:\s*[→↗›])?$/i.test(label)&&!el.hasAttribute("data-ea-intro-enter"))
        el.setAttribute("data-ea-intro-enter","");
    }
  }
  function animateEntry(){
    if(!current||reduced?.matches)return;
    const gsap=window.gsap;
    if(gsap?.fromTo){
      gsap.fromTo(current,{"--ea-shine":.3},{"--ea-shine":1,duration:1.3,ease:"power2.out",overwrite:true});
    }else if(!gsapRequested){
      gsapRequested=true;
      const script=document.createElement("script");
      script.src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      script.async=true;script.referrerPolicy="no-referrer";
      script.onload=()=>{if(current)animateEntry();};
      document.head.appendChild(script);
    }
  }
  function scan(){
    scheduled=false;
    const el=document.querySelector(selector);
    const next=el&&!el.closest("[hidden]")&&el.getClientRects().length>0?el:null;
    if(next!==current){
      if(raf)cancelAnimationFrame(raf);
      raf=0;current=next;base=null;n=0;betaSum=gammaSum=0;
      target=liquid=velocity=phase=0;last=0;sensorSeen=false;logoRed=false;
      parentLogo(!!current,false);
      if(current){draw(0,0);animateEntry();}
    }
    if(current)markEnter(current);
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
  window.addEventListener("deviceorientation",orientation,{passive:true});
  window.addEventListener("pointermove",pointer,{passive:true});
  window.addEventListener("pointerdown",requestMotion,{passive:true});
  window.addEventListener("resize",()=>{if(current){draw(liquid,velocity);paint();}},{passive:true});
  window.addEventListener("pagehide",()=>{parentLogo(false,false);current=null;if(raf)cancelAnimationFrame(raf);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&current)paint();});
  const observer=new MutationObserver(schedule);
  function init(){
    if(!document.body){document.addEventListener("DOMContentLoaded",init,{once:true});return;}
    observer.observe(document.body,{childList:true,subtree:true});
    scan();
  }
  init();
})();