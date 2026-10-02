"use client";

import { useEffect, useRef, useState } from "react";

type ActiveFrameInstance = {
  loading: Promise<void>;
  manifest?: { totalFrames?: number };
  setFrame: (frame:number)=>void;
  destroy: ()=>void;
};

declare global {
  interface Window {
    ActiveFrame?: new (
      file:string,
      options:{ process:(frame:any)=>void|Promise<void>; hardwareAcceleration?:string }
    )=>ActiveFrameInstance;
  }
}

const RUNTIME_SRC = "https://forgeautomotive.co.uk/ActiveFrame.js";

function ensureActiveFrameRuntime(){
  if(typeof window==="undefined")return Promise.reject(new Error("no-window"));
  if(window.ActiveFrame)return Promise.resolve();

  return new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-enchev-active-frame="1"]');
    if(existing){
      if(window.ActiveFrame){resolve();return;}
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("ActiveFrame runtime failed")), {once:true});
      return;
    }

    const script=document.createElement("script");
    script.src=RUNTIME_SRC;
    script.async=true;
    script.dataset.enchevActiveFrame="1";
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error("ActiveFrame runtime failed"));
    document.head.appendChild(script);
  });
}

function drawCover(canvas:HTMLCanvasElement,frame:any){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;

  const dpr=Math.min(window.devicePixelRatio||1,1.6);
  const pixelWidth=Math.max(1,Math.round(rect.width*dpr));
  const pixelHeight=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){
    canvas.width=pixelWidth;
    canvas.height=pixelHeight;
  }

  const ctx=canvas.getContext("2d",{alpha:true});
  if(!ctx)return;

  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);

  const sourceWidth=frame.displayWidth||frame.codedWidth||frame.width||1;
  const sourceHeight=frame.displayHeight||frame.codedHeight||frame.height||1;
  const scale=Math.max(rect.width/sourceWidth,rect.height/sourceHeight);
  const width=sourceWidth*scale;
  const height=sourceHeight*scale;
  const x=(rect.width-width)/2;
  const y=(rect.height-height)/2;

  ctx.drawImage(frame,x,y,width,height);
}

function easeOutQuart(value:number){
  return 1-Math.pow(1-value,4);
}

export default function CinematicVehicleMotion(){
  const introCanvas=useRef<HTMLCanvasElement>(null);
  const scrollCanvas=useRef<HTMLCanvasElement>(null);
  const [state,setState]=useState<"idle"|"loading"|"ready"|"fallback">("idle");

  useEffect(()=>{
    let intro:ActiveFrameInstance|null=null;
    let scroll:ActiveFrameInstance|null=null;
    let introRaf=0;
    let scrollRaf=0;
    let cancelled=false;
    let introDone=false;
    let lastScrollFrame=-1;

    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canDecode="VideoDecoder" in window && window.isSecureContext;
    if(reduced||!canDecode){
      setState("fallback");
      return;
    }

    const syncScroll=()=>{
      scrollRaf=0;
      if(!scroll||!scroll.manifest?.totalFrames||!introDone)return;

      const hero=document.querySelector<HTMLElement>(".eaCinematicHero");
      if(!hero)return;
      const rect=hero.getBoundingClientRect();
      const travel=Math.max(window.innerHeight*.82,1);
      const progress=Math.max(0,Math.min(1,-rect.top/travel));
      const frame=Math.round(progress*(scroll.manifest.totalFrames-1));
      if(frame===lastScrollFrame)return;
      lastScrollFrame=frame;
      scroll.setFrame(frame);

      if(scrollCanvas.current){
        scrollCanvas.current.style.opacity=progress>.015?"1":"0";
      }
      if(introCanvas.current){
        introCanvas.current.style.opacity=progress>.015?"0":"1";
      }
    };

    const onScroll=()=>{
      if(scrollRaf)return;
      scrollRaf=window.requestAnimationFrame(syncScroll);
    };

    const start=async()=>{
      setState("loading");
      try{
        await ensureActiveFrameRuntime();
        if(cancelled||!window.ActiveFrame)return;

        const mobile=window.matchMedia("(max-width: 820px)").matches;
        const introSource=mobile
          ? "/api/cinematic-media?asset=heroMobile"
          : "/api/cinematic-media?asset=heroDesktop";

        intro=new window.ActiveFrame(introSource,{
          hardwareAcceleration:"prefer-hardware",
          process:(frame:any)=>{
            const canvas=introCanvas.current;
            if(!canvas)return;
            drawCover(canvas,frame);
            canvas.dataset.frameReady="true";
            if(!introDone)canvas.style.opacity="1";
          }
        });

        scroll=new window.ActiveFrame("/api/cinematic-media?asset=introScroll",{
          hardwareAcceleration:"prefer-hardware",
          process:(frame:any)=>{
            const canvas=scrollCanvas.current;
            if(!canvas)return;
            drawCover(canvas,frame);
            canvas.dataset.frameReady="true";
          }
        });

        await Promise.all([intro.loading,scroll.loading]);
        if(cancelled||!intro?.manifest?.totalFrames)return;

        setState("ready");
        const total=Math.max(1,intro.manifest.totalFrames-1);
        const duration=2050;
        const started=performance.now();

        const play=(now:number)=>{
          if(cancelled||!intro)return;
          const t=Math.min(1,(now-started)/duration);
          intro.setFrame(Math.round(easeOutQuart(t)*total));
          if(t<1){
            introRaf=window.requestAnimationFrame(play);
          }else{
            introDone=true;
            syncScroll();
          }
        };

        intro.setFrame(0);
        introRaf=window.requestAnimationFrame(play);
        window.addEventListener("scroll",onScroll,{passive:true});
        window.addEventListener("resize",onScroll,{passive:true});
      }catch(error){
        console.warn("ENCHEV cinematic motion fallback:",error);
        setState("fallback");
      }
    };

    start();

    return()=>{
      cancelled=true;
      window.cancelAnimationFrame(introRaf);
      window.cancelAnimationFrame(scrollRaf);
      window.removeEventListener("scroll",onScroll);
      window.removeEventListener("resize",onScroll);
      intro?.destroy();
      scroll?.destroy();
    };
  },[]);

  return <div className="eaForgeMotion" data-motion-state={state} aria-hidden="true">
    <img className="eaForgeMotionFallback" src="/api/cinematic-media?asset=lineup" alt=""/>
    <canvas ref={introCanvas} className="eaForgeMotionCanvas eaForgeMotionCanvas--intro"/>
    <canvas ref={scrollCanvas} className="eaForgeMotionCanvas eaForgeMotionCanvas--scroll"/>
    <div className="eaForgeMotionVignette"/>
  </div>;
}
