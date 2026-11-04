/* E&A desktop cinematic recovery: visible model fallback if the original
 * WebCodecs/WebGL intro fails to paint on desktop after the ads.
 * Original animated canvases remain the preferred presentation. */
(() => {
  "use strict";
  if (!window.matchMedia("(min-width: 1024px)").matches) return;
  let invoked=false, attempts=0, fallback=null, modelScript=null, timers=[];
  const modelSrc="https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/34499c501908818a2b08e589a7aecf963343cee7/spectral_gt_rs_game_ready.glb";
  const modelPoster="https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/34499c501908818a2b08e589a7aecf963343cee7/spectral_gt_beauty.png";
  function scene() {
    // Forge removes the ENTIRE video background on unsupported desktop
    // decoders. Its scene heading remains in the DOM even without a canvas.
    const heading=document.querySelector('[data-sanity*="path=introductionHeading"]');
    const section=heading?.closest("section")||
      document.querySelector("section.sc-2b039258-0");
    if(!section)return null;
    const canvas=section.querySelector("canvas.sc-2b039258-2");
    return {canvas,wrap:canvas?.parentElement||section};
  }
  function hasPixels(canvas){
    if(!canvas||canvas.width<4||canvas.height<4)return false;
    try {
      const ctx=canvas.getContext("2d");
      if(!ctx)return false;
      const coords=[[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75],[.3,.3],[.7,.7]];
      let count=0,nonBlack=0;
      for(const [x,y] of coords){
        const data=ctx.getImageData(
          Math.max(0,Math.min(canvas.width-1,Math.round(x*canvas.width))),
          Math.max(0,Math.min(canvas.height-1,Math.round(y*canvas.height))),1,1
        ).data;
        if(data[3]>20){count++;if(data[0]+data[1]+data[2]>22)nonBlack++;}
      }
      return count>=3 && nonBlack>=2;
    }catch{return false;}
  }
  function activeFrame(){
    const instances=window.__enchevActiveFrames;
    if(!instances)return null;
    return Array.from(instances).find(x=>/intro-scroll\.af/.test(x.file||""))||null;
  }
  function hideFallback(){
    if(!fallback)return;
    const canvas=scene()?.canvas;
    if(canvas)canvas.style.removeProperty("opacity");
    fallback.remove();fallback=null;
  }
  function loadModel(stage) {
    if(!fallback||fallback.dataset.modelAttempted)return;
    fallback.dataset.modelAttempted="true";
    const model=document.createElement("model-viewer");
    model.setAttribute("src",modelSrc);
    model.setAttribute("poster",modelPoster);
    model.setAttribute("alt","Spectral GT RS — 3D animated automobile backup");
    model.setAttribute("auto-rotate","");
    model.setAttribute("auto-rotate-delay","0");
    model.setAttribute("rotation-per-second","8deg");
    model.setAttribute("camera-orbit","45deg 73deg 10m");
    model.setAttribute("environment-image","neutral");
    model.setAttribute("shadow-intensity",".7");
    model.setAttribute("loading","eager");
    model.style.cssText="position:absolute;inset:0;display:block;width:100%;height:100%;"+
      "background:transparent;opacity:0;transition:opacity .8s ease;pointer-events:none";
    model.addEventListener("load",()=>{
      if(fallback===stage && model.isConnected)model.style.opacity="1";
    },{once:true});
    model.addEventListener("error",()=>{
      model.remove(); // keep the already visible same-site car photograph
    },{once:true});
    stage.appendChild(model);
    if(customElements.get("model-viewer"))return;
    if(document.querySelector('script[data-ea-model-viewer]'))return;
    modelScript=document.createElement("script");
    modelScript.type="module";
    modelScript.dataset.eaModelViewer="true";
    modelScript.src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.4.0/dist/model-viewer.min.js";
    modelScript.async=true;
    document.head.appendChild(modelScript);
  }
  function showFallback(){
    const source=scene();
    if(!source?.wrap||fallback)return;
    const stage=document.createElement("div");
    stage.className="eaDesktop3dRecovery";
    stage.setAttribute("aria-hidden","true");
    stage.style.cssText="position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;"+
      "background:#09090a;opacity:1;";
    const poster=document.createElement("img");
    poster.src="/forge/media/a17d6f586aa86c26d371.jpg";
    poster.alt="";
    poster.decoding="async";
    poster.style.cssText="position:absolute;inset:-4%;width:108%;height:108%;"+
      "object-fit:cover;object-position:center;filter:brightness(.63) contrast(1.15);"+
      "animation:ea3dFallbackDrift 18s ease-in-out infinite alternate;pointer-events:none";
    stage.appendChild(poster);
    source.wrap.prepend(stage);
    if(source.canvas){
      source.canvas.style.position="relative";
      source.canvas.style.zIndex="1";
      source.canvas.style.opacity="0";
    }
    fallback=stage;
    if(!document.getElementById("ea3dFallbackStyle")){
      const style=document.createElement("style");
      style.id="ea3dFallbackStyle";
      style.textContent="@keyframes ea3dFallbackDrift{from{transform:scale(1) translate3d(-1%,0,0)}to{transform:scale(1.06) translate3d(1%,0,0)}}"+
        "@media(prefers-reduced-motion:reduce){.eaDesktop3dRecovery img{animation:none!important}}";
      document.head.appendChild(style);
    }
    // The independent 3D GLB remains available when WebCodecs fail.
    // The real Forge animation wins immediately if its canvas begins painting.
    loadModel(stage);
  }
  function check(){
    attempts++;
    const view=scene();
    if(!view){
      // Intro may still be hydrating; retry before giving up.
      if(attempts<13)timers.push(setTimeout(check,1500));
      return;
    }
    if(hasPixels(view.canvas)){
      hideFallback();
      return;
    }
    const af=activeFrame();
    if(af?.manifest&&af.enabled&&af.frameProcessed==null&&attempts===2){
      try{af.refresh(af.desideredFrame??0);}catch{}
    }
    // Missing canvas means unsupported WebCodecs: show fallback immediately.
    // A slow but present canvas gets one recovery attempt first.
    if(!view.canvas||attempts>=2)showFallback();
    // Back off once the native animation has had ample time to recover.
    if(attempts<13)timers.push(setTimeout(check,2000));
  }
  window.addEventListener("message",(event)=>{
    if(event.origin!==location.origin||event.source!==parent||
      event.data?.type!=="ENCHEV_FORGE_RESUME"||invoked)return;
    invoked=true;
    timers.push(setTimeout(check,900));
  });
  window.addEventListener("pagehide",()=>{timers.forEach(clearTimeout);timers=[];hideFallback();});
})();