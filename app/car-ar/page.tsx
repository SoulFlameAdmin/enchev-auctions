"use client";

import { useEffect, useState } from "react";
import { createElement } from "react";
import Link from "next/link";
import "./car-ar.css";

const modelUrl = "https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/34499c501908818a2b08e589a7aecf963343cee7/spectral_gt_rs_game_ready.glb";
const posterUrl = "https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/34499c501908818a2b08e589a7aecf963343cee7/spectral_gt_beauty.png";

export default function CarArPage() {
  const [arSupported, setArSupported] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.4.0/dist/model-viewer.min.js";
    script.dataset.carArModelViewer = "true";
    document.head.appendChild(script);

    let viewer: (HTMLElement & { canActivateAR?: boolean }) | null = null;
    let checks = 0;
    let retry: ReturnType<typeof setInterval> | undefined;
    const checkSupport = () => {
      if (!active) return;
      viewer = document.getElementById("carArViewer") as (HTMLElement & { canActivateAR?: boolean }) | null;
      if (viewer) setArSupported(Boolean(viewer.canActivateAR));
      checks++;
      if (checks >= 25 && retry) clearInterval(retry);
    };
    const onLoad = () => { setViewerReady(true); checkSupport(); };
    const onError = () => setLoadFailed(true);
    const onArStatus = (event: Event) => {
      const status = (event as CustomEvent<{status:string}>).detail?.status;
      if (status === "failed") setArSupported(false);
    };
    viewer = document.getElementById("carArViewer") as HTMLElement;
    viewer?.addEventListener("load", onLoad);
    viewer?.addEventListener("error", onError);
    viewer?.addEventListener("ar-status", onArStatus);
    window.customElements.whenDefined("model-viewer").then(() => { if (active) checkSupport(); }).catch(() => {});
    retry = setInterval(checkSupport, 700);
    return () => {
      active = false;
      if (retry) clearInterval(retry);
      viewer?.removeEventListener("load", onLoad);
      viewer?.removeEventListener("error", onError);
      viewer?.removeEventListener("ar-status", onArStatus);
      script.remove();
    };
  }, []);

  return (
    <main className="carArPage">
      <header className="carArHeader">
        <Link className="carArBrand" href="/" aria-label="ENCHEV AUCTIONS начална страница">
          <span className="carArBrandTitle">ENCHEV<span className="brandPeriod">.</span></span>
          <span className="carArBrandTag">AUCTIONS <span>×</span> SOULFLAME</span>
        </Link>
        <div className="carArTopRight"><span className="carArIndicator"></span> INTERACTIVE VEHICLE EXPERIENCE</div>
      </header>

      <div className="carArIntro">
        <span className="carArOverline">SOULFLAME PRESENTS / WEBXR</span>
        <h1><strong>Car</strong>AR<span className="brandPeriod">.</span></h1>
        <p>Твоят автомобил. Твоето пространство. Премести го в реалния свят или го разгледай от всеки ъгъл.</p>
      </div>

      <section className="carArStage" aria-label="3D автомобил и AR режим">
        {createElement(
          "model-viewer",
          {
            id: "carArViewer",
            src: modelUrl,
            poster: posterUrl,
            alt: "Реален 3D автомобил Spectral GT RS — върти го на 360 градуса",
            ar: "",
            "ar-modes": "webxr scene-viewer quick-look",
            "ar-placement": "floor",
            "ar-scale": "auto",
            "camera-controls": "",
            "auto-rotate": "",
            "auto-rotate-delay": "1800",
            "rotation-per-second": "12deg",
            "interaction-prompt": "auto",
            "shadow-intensity": "1",
            "shadow-softness": ".9",
            exposure: "1.35",
            "environment-image": "neutral",
            "camera-orbit": "45deg 73deg 10m",
            "field-of-view": "30deg",
            "touch-action": "pan-y",
            style: {display:"block",width:"100%",height:"100%",background:"transparent"},
          },
          createElement("button", {slot:"ar-button", className:"carArNativeButton", type:"button"}, "ПОСТАВИ КОЛАТА В AR ↗")
        )}
        <div className="carArViewportLabel"><span className="carArViewDot"></span>{arSupported ? "AR READY" : "360° GLB VIEWER"}</div>
        <div className="carArViewportHint">↔ Завърти · + / − Приближи</div>
        {loadFailed && (
          <div className="carArError">
            <p>3D моделът не можа да се зареди от GitHub.</p>
            <a href={modelUrl} target="_blank" rel="noopener noreferrer">Отвори оригиналния GLB файл ↗</a>
          </div>
        )}
      </section>

      <div className="carArActions">
        <div>
          <h2>{arSupported ? "Постави автомобила пред себе си" : "Разгледай автомобила на 360°"}</h2>
          <p>{arSupported ? "Докосни бутона AR в 3D изгледа. Камерата ще ти помогне да поставиш колата." : "AR не е наличен в този браузър или устройство. 3D автомобилът остава интерактивен и може да се върти на 360°."}</p>
        </div>
        <Link className="carArReturn" href="/">КЪМ ENCHEV <span>↗</span></Link>
      </div>

      <footer className="carArFooter">
        <span>ENCHEV AUCTIONS · POWERED BY SOULFLAME</span>
        <span>{viewerReady ? "ORIGINAL GLB LOADED" : "360° VIEWER / WEBXR"}</span>
      </footer>
    </main>
  );
}
