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
  const [promoOpen,setPromoOpen]=useState(false);
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

  // Close the most recently opened overlay first (nested iframe promo
  // before the outer login dialog). DOM check also handles fast clicks
  // before the iframe's state message has reached React.
  const closeTopmost=useCallback(()=>{
    let childVisible=promoOpen;
    try{
      const child=cinematicFrame.current?.contentDocument?.getElementById("cararPromo");
      if(child)childVisible=child.classList.contains("is-visible");
    }catch{/* same-origin iframe not available: use reported state */}
    if(childVisible){
      cinematicFrame.current?.contentWindow?.postMessage(
        {type:"ENCHEV_CARAR_PROMO_CLOSE"},window.location.origin
      );
      return;
    }
    dismiss();
  },[promoOpen,dismiss]);


  // Only this same-origin cinematic iframe controls the nested ad state.
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin)return;
      if(event.source!==cinematicFrame.current?.contentWindow)return;
      if(event.data?.type==="ENCHEV_CAR_AR_READY")setArReady(true);
      if(event.data?.type==="ENCHEV_CARAR_PROMO_STATE"){
        setPromoOpen(event.data.visible===true);
      }
    };
    window.addEventListener("message",receive);
    return()=>window.removeEventListener("message",receive);
  },[]);

  const syncChildPromo=useCallback(()=>{
    setPromoOpen(false);
    cinematicFrame.current?.contentWindow?.postMessage(
      {type:"ENCHEV_CARAR_PROMO_QUERY"},window.location.origin
    );
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
    const keydown=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      event.preventDefault();
      closeTopmost();
    };
    window.addEventListener("keydown",keydown);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",keydown);};
  },[open,closeTopmost]);

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
      <style>{"\n.enchevQrDock{\n  position:relative;flex:0 0 278px;width:278px;align-self:center;\n  display:none;flex-direction:column;align-items:center;gap:12px;\n  opacity:0;visibility:hidden;transform:translateX(35px);\n  transition:opacity .75s ease,transform .85s cubic-bezier(.2,.85,.2,1),visibility 0s .85s;\n  pointer-events:none;\n}\n.enchevQrDock.visible{\n  display:flex;opacity:1;visibility:visible;transform:translateX(0);pointer-events:auto;\n  transition:opacity .75s ease,transform .85s cubic-bezier(.2,.85,.2,1);\n}\n.enchevQrCode{\n  position:relative;width:154px;display:flex;flex-direction:column;align-items:center;gap:7px;\n  padding:14px 13px;border:1px solid rgba(221,185,126,.55);\n  border-radius:9px;background:linear-gradient(150deg,#24252bee,#0d1015fa);\n  box-shadow:0 18px 48px rgba(0,0,0,.68);\n  color:white;text-decoration:none;\n}\n.enchevQrCode:before{\n  content:\"\";position:absolute;top:48%;left:-14px;width:13px;height:23px;\n  background:#24252b;clip-path:polygon(100% 0,0 50%,100% 100%);\n}\n.enchevQrCode:hover{border-color:#edcd99;background:#292b31}\n.enchevQrCode .qrEyebrow{font-size:8px;font-weight:750;color:#dbc39f;letter-spacing:.18em}\n.enchevQrCode img{display:block;width:119px;height:119px;image-rendering:pixelated;border-radius:4px;background:#fff;padding:1px}\n.enchevQrCode .qrLabel{font-size:10px;font-weight:750;letter-spacing:.12em;text-align:center}\n.enchevQrCode .qrHelper{font-size:9px;color:#abb0b8;text-align:center;line-height:1.35}\n.enchevQrCta{\n  width:100%;display:flex;align-items:center;gap:12px;min-height:66px;\n  padding:11px 13px;border:1px solid rgba(221,185,126,.62);border-radius:7px;\n  background:linear-gradient(112deg,#252329f5,#121419f5);\n  box-shadow:0 12px 37px rgba(0,0,0,.65);\n  text-decoration:none;color:white;\n  transition:border-color .2s,background .2s,transform .2s;\n}\n.enchevQrCta:hover{border-color:#e9c99b;background:linear-gradient(105deg,#39302e,#191a1d);transform:translateY(-2px)}\n.qrArBadge{height:37px;width:39px;flex:0 0 auto;display:grid;place-items:center;\n  border:1px solid #b298746e;border-radius:4px;color:#e9ceaa;\n  font-size:13px;font-weight:800;letter-spacing:.02em}\n.qrArText{min-width:0;display:flex;flex:1;flex-direction:column;gap:5px}\n.qrArText strong{font-size:12px;letter-spacing:.06em;white-space:nowrap;font-weight:800}\n.qrArText small{font-size:10px;color:#acb1ba;white-space:nowrap}\n.qrArArrow{font-size:20px;color:#e9c49a;flex:0 0 auto}\n@media(max-width:1050px){.enchevQrDock,.enchevQrDock.visible{display:none}}\n"}</style>
      <style>{`
@media(max-width:720px){
  .enchevLoginDialog{
    width:calc(100vw - 20px)!important;
    height:calc(100dvh - 28px)!important;
    max-height:calc(100dvh - 28px)!important;
    border-radius:13px!important;
  }
  .enchevLoginClose{
    top:calc(43% + 9px)!important;
    right:12px!important;
    width:34px!important;
    height:34px!important;
    border-radius:9px!important;
    font-size:25px!important;
    background:rgba(21,22,27,.94)!important;
    border:1px solid rgba(223,193,150,.48)!important;
    box-shadow:0 4px 18px #0007!important;
  }
}
@media(max-width:720px) and (max-height:600px){
  .enchevLoginClose{top:calc(43% + 4px)!important}
}

/* Full-screen cinematic, without the old framed login/modal layout. */
.enchevLoginDialog{
 width:100vw!important;height:100dvh!important;max-height:100dvh!important;
 min-height:100dvh!important;border:0!important;border-radius:0!important;
 overflow:hidden!important;
}
.enchevLoginClose{
 position:absolute!important;
 top:max(18px,env(safe-area-inset-top))!important;
 right:max(18px,env(safe-area-inset-right))!important;
 width:48px!important;height:48px!important;
 border-radius:50%!important;
 display:grid!important;place-items:center!important;
 background:rgba(5,7,12,.82)!important;
 border:1px solid rgba(230,202,162,.7)!important;
 box-shadow:0 8px 28px rgba(0,0,0,.7)!important;
 font-size:28px!important;
}
.enchevQrDock,.enchevQrDock.visible{display:none!important}
@media(max-width:720px){
 .enchevLoginClose{top:max(12px,env(safe-area-inset-top))!important;
 right:max(12px,env(safe-area-inset-right))!important;
 width:43px!important;height:43px!important}
}
`}</style>
      {hasOpened && (
        <div
          data-enchev-login-overlay
          inert={!open}
          aria-hidden={!open}
          onClick={event=>{if(open && event.currentTarget===event.target)closeTopmost();}}
          style={{
            position:"fixed",inset:0,zIndex:2147483000,
            opacity:open?1:0,
            pointerEvents:open?"auto":"none",
            background:open&&revealed?"rgba(0,0,0,.65)":"transparent",
            backdropFilter:"none",
            transition:"background .45s, opacity .45s, backdrop-filter .45s",
            display:"flex",gap:0,justifyContent:"center",alignItems:"center",padding:0
          }}
        >
          <section
            className="enchevLoginDialog"
            role="dialog"
            aria-modal={open}
            aria-label="E&A — презентация 2 и CarAR"
            style={{
              position:"relative",
              width:"100vw",
              height:"100dvh",
              maxHeight:"100dvh",
              flexShrink:1,minWidth:0,
              overflow:"hidden",
              borderRadius:0,
              background:"#000",
              border:"none",
              boxShadow:"none",
              opacity:open&&revealed?1:0,
              transform:"none",
              transition:"opacity .45s ease"
            }}
          >
            <iframe
              ref={cinematicFrame}
              src="/3d-login/index.html"
              title="E&A Presentation 2 full-screen video and CarAR"
              loading="eager"
              onLoad={syncChildPromo}
              style={{display:"block",width:"100%",height:"100%",border:0,background:"#000"}}
            />
            {open && !promoOpen && <button
              className="enchevLoginClose"
              ref={close}
              type="button"
              onClick={closeTopmost}
              aria-label="Затвори прозореца за вход"
              title="Затвори"
              style={{
                position:"absolute",top:18,right:18,zIndex:10,
                width:48,height:48,borderRadius:"50%",
                color:"#fff",background:"rgba(9,10,15,.85)",
                border:"1px solid rgba(255,255,255,.48)",
                backdropFilter:"blur(12px)",cursor:"pointer",
                fontSize:26,fontWeight:300,lineHeight:1
              }}
            >×</button>}
          </section>

          <aside className={"enchevQrDock"+(arReady&&open&&revealed&&!promoOpen?" visible":"")} aria-label="CarAR QR код и WebXR достъп">
            <a
              className="enchevQrCode"
              href="/car-ar"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Сканирай QR кода за CarAR WebXR и 360° GLB модел"
            >
              <span className="qrEyebrow">SCAN FOR AR</span>
              <img src={"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAACMAQAAAACGu3yTAAABAElEQVR42uWWsU0FQAxDnxG9swH7j/U3cCYwxYcGOkKDSBVdYTl2FJ/Kl9oXvtVff1pJO0iwkm7wbbxLJNrcsFbAW+Cj/THW69O7WHR+S0Kj3LFc8D7iwT3OKMgCDxD051i0bdO0/ugv+8XuMDtEmuXCK6HFcRvgxMsgEnYXn3aVhtZ2cIMvvGgdqBvHrW9YxdSQctOLxolDnzbkxivUJBC7V71MS2P3qldc25hefVRBgTfIWsF70st2KHbSq48FP9cCH31smxJC09zuhCTEYBZxz6HWFaacc2gHxmjmnh2G5RE390xjVY1Bl3v/mUNZs4uPM0qzGXAsfMDSP/h/vQOJcM0xnmZGVQAAAABJRU5ErkJggg=="} width="119" height="119" alt="QR код: enchev-auctions.vercel.app/car-ar" />
              <span className="qrLabel">CARAR ↗</span>
              <span className="qrHelper">WebXR · 360° GLB</span>
            </a>
            <a
              className="enchevQrCta"
              href="/car-ar"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MAKE YOUR CAR AR — отвори WebXR или 360° GLB модел"
            >
              <span className="qrArBadge">AR</span>
              <span className="qrArText">
                <strong>MAKE YOUR CAR → AR</strong>
                <small>Отвори в телефона · 360° fallback</small>
              </span>
              <span className="qrArArrow" aria-hidden="true">↗</span>
            </a>
          </aside>
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
