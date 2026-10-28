"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Centered ENCHEV entrance. No embedded external experience runs before ENTER.
 * Keep the iframe mounted after closing, so the three-second frozen scene
 * is not replayed until a full page refresh.
 */
export default function EnchevCinematicLoginGate() {
  const [open,setOpen]=useState(false);
  const [hasOpened,setHasOpened]=useState(false);
  const [revealed,setRevealed]=useState(false);
  const [arReady,setArReady]=useState(false);
  const launcher=useRef<HTMLButtonElement>(null);
  const close=useRef<HTMLButtonElement>(null);
  const cinematicFrame=useRef<HTMLIFrameElement>(null);

  const show=useCallback(()=>{
    setHasOpened(true);
    setRevealed(false);
    setOpen(true);
  },[]);

  const dismiss=useCallback(()=>{
    setRevealed(false);
    setOpen(false);
    window.requestAnimationFrame(()=>launcher.current?.focus());
  },[]);


  // The same-origin cinematic iframe reports when the CarAR reveal is finished.
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin)return;
      if(event.source!==cinematicFrame.current?.contentWindow)return;
      if(event.data?.type==="ENCHEV_CAR_AR_READY")setArReady(true);
    };
    window.addEventListener("message",receive);
    return()=>window.removeEventListener("message",receive);
  },[]);

  // Original welcome ENTER stays functional; only add the login advertising modal.
  useEffect(()=>{
    const forge=document.querySelector<HTMLIFrameElement>(
      'iframe[title="ENCHEV Auctions cinematic homepage"]'
    );
    if(!forge)return;
    let detach:(()=>void)|undefined;
    const attach=()=>{
      detach?.();
      let doc:Document|null=null;
      try{doc=forge.contentDocument;}catch{/* same origin required */}
      if(!doc)return;
      const onClick=(event:MouseEvent)=>{
        let node=event.target as Element|null;
        for(let depth=0;node&&depth<7;depth++,node=node.parentElement){
          const label=(node.textContent||node.getAttribute("aria-label")||"")
            .replace(/\s+/g," ").trim();
          if(/^ENTER(?:\s*[→↗›])?$/i.test(label)){
            window.requestAnimationFrame(show);
            return;
          }
        }
      };
      doc.addEventListener("click",onClick,true);
      detach=()=>doc?.removeEventListener("click",onClick,true);
    };
    forge.addEventListener("load",attach);
    attach();
    return()=>{forge.removeEventListener("load",attach);detach?.();};
  },[show]);

  useEffect(()=>{
    if(!open)return;
    const raf=requestAnimationFrame(()=>{
      setRevealed(true);
      close.current?.focus();
    });
    const keydown=(event:KeyboardEvent)=>{if(event.key==="Escape")dismiss();};
    window.addEventListener("keydown",keydown);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",keydown);};
  },[open,dismiss]);

  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(open || event.key!=="Enter" || event.repeat)return;
      const element=event.target as HTMLElement|null;
      if(element?.closest("input,textarea,select,button,a,[contenteditable=true]"))return;
      show();
    };
    window.addEventListener("keydown",keydown);
    return()=>window.removeEventListener("keydown",keydown);
  },[open,show]);

  return (
    <>
      <style>{"\n.enchevQrDock{position:relative;flex:0 0 142px;width:142px;align-self:center;\ndisplay:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 11px 13px;\nborder:1px solid rgba(221,185,126,.55);border-radius:10px;\nbackground:linear-gradient(150deg,rgba(34,36,42,.98),rgba(11,13,17,.98));\nbackdrop-filter:blur(12px);box-shadow:0 20px 55px rgba(0,0,0,.78);\ntext-decoration:none;color:white;\ntransition:opacity .7s,transform .8s cubic-bezier(.2,.85,.2,1);\nopacity:0;transform:translateX(35px);pointer-events:none}\n.enchevQrDock.visible{opacity:1;transform:translateX(0);pointer-events:auto}\n.enchevQrDock:before{content:\"\";position:absolute;top:49%;left:-14px;width:13px;height:23px;\nbackground:#24252b;clip-path:polygon(100% 0,0 50%,100% 100%)}\n.enchevQrDock:hover{border-color:#eacb99;background:#282a30}\n.enchevQrDock .qrEyebrow{font-size:8px;font-weight:750;color:#dbc39f;letter-spacing:.19em}\n.enchevQrDock img{display:block;width:119px;height:119px;image-rendering:pixelated;border-radius:4px;background:#fff;padding:1px}\n.enchevQrDock .qrLabel{font-size:10px;font-weight:750;letter-spacing:.12em;text-align:center}\n.enchevQrDock .qrHelper{font-size:9px;color:#abb0b8;text-align:center;line-height:1.35}\n@media(max-width:900px){.enchevQrDock{display:none}}\n"}</style>
      {hasOpened && (
        <div
          data-enchev-login-overlay
          inert={!open}
          aria-hidden={!open}
          onClick={event=>{if(open && event.currentTarget===event.target)dismiss();}}
          style={{
            position:"fixed",inset:0,zIndex:2147483000,
            opacity:open?1:0,
            pointerEvents:open?"auto":"none",
            background:open&&revealed?"rgba(0,0,0,.65)":"transparent",
            backdropFilter:open&&revealed?"blur(5px)":"blur(0px)",
            transition:"background .45s, opacity .45s, backdrop-filter .45s",
            display:"flex",gap:15,justifyContent:"center",alignItems:"center",padding:12
          }}
        >
          <section
            role="dialog"
            aria-modal={open}
            aria-label="ENCHEV AUCTIONS — cinematic login"
            style={{
              position:"relative",
              width:"min(1080px, calc(100vw - 32px))",
              height:"min(640px, calc(100dvh - 48px))",
              maxHeight:"calc(100dvh - 24px)",
              flexShrink:1,minWidth:0,
              overflow:"hidden",
              borderRadius:15,
              background:"#06070a",
              border:"1px solid rgba(221,194,152,.42)",
              boxShadow:"0 26px 110px rgba(0,0,0,.88)",
              opacity:open&&revealed?1:0,
              transform:open&&revealed?"translateY(0) scale(1)":"translateY(19px) scale(.97)",
              transition:"opacity .5s ease, transform .5s cubic-bezier(.18,.8,.21,1)"
            }}
          >
            <iframe
              ref={cinematicFrame}
              src="/3d-login/index.html"
              title="SoulFlame Presents CarAR and ENCHEV sign in"
              loading="eager"
              style={{display:"block",width:"100%",height:"100%",border:0,background:"#06070a"}}
            />
            {open && <button
              ref={close}
              type="button"
              onClick={dismiss}
              aria-label="Затвори прозореца"
              title="Затвори"
              style={{
                position:"absolute",top:12,right:12,zIndex:10,
                width:44,height:44,borderRadius:"50%",
                color:"#fff",background:"rgba(9,10,15,.85)",
                border:"1px solid rgba(255,255,255,.48)",
                backdropFilter:"blur(12px)",cursor:"pointer",
                fontSize:26,fontWeight:300,lineHeight:1
              }}
            >×</button>}
          </section>

          <a
            className={"enchevQrDock"+(arReady&&open&&revealed?" visible":"")}
            href="/car-ar"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Сканирай за CarAR WebXR или 360 градусов 3D модел"
          >
            <span className="qrEyebrow">SCAN FOR AR</span>
            <img src={"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAACMAQAAAACGu3yTAAABAElEQVR42uWWsU0FQAxDnxG9swH7j/U3cCYwxYcGOkKDSBVdYTl2FJ/Kl9oXvtVff1pJO0iwkm7wbbxLJNrcsFbAW+Cj/THW69O7WHR+S0Kj3LFc8D7iwT3OKMgCDxD051i0bdO0/ugv+8XuMDtEmuXCK6HFcRvgxMsgEnYXn3aVhtZ2cIMvvGgdqBvHrW9YxdSQctOLxolDnzbkxivUJBC7V71MS2P3qldc25hefVRBgTfIWsF70st2KHbSq48FP9cCH31smxJC09zuhCTEYBZxz6HWFaacc2gHxmjmnh2G5RE390xjVY1Bl3v/mUNZs4uPM0qzGXAsfMDSP/h/vQOJcM0xnmZGVQAAAABJRU5ErkJggg=="} width="119" height="119" alt="QR код: enchev-auctions.vercel.app/car-ar" />
            <span className="qrLabel">CARAR ↗</span>
            <span className="qrHelper">WebXR · 360° GLB</span>
          </a>
        </div>
      )}
      {!open && hasOpened && <button
        ref={launcher}
        type="button"
        onClick={show}
        aria-label="Отвори отново входа"
        style={{
          position:"fixed",right:"max(18px, env(safe-area-inset-right))",
          bottom:"max(18px, env(safe-area-inset-bottom))",
          zIndex:2147482000,
          padding:"13px 17px",
          border:"1px solid #b99c72",
          background:"rgba(9,10,15,.96)",color:"#ead4af",
          borderRadius:4,fontSize:11,letterSpacing:".1em",fontWeight:700,
          cursor:"pointer",boxShadow:"0 8px 30px #0008"
        }}
      >ВХОД ↗</button>}
    </>
  );
}
