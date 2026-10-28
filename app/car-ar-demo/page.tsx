"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./car-ar-demo.css";

/**
 * Desktop: preserve the existing, fully interactive Lusion Gemini
 * color-changing car iframe. Mobile: open our original first-party
 * model-viewer route directly so native WebXR/Scene Viewer can receive
 * a genuine user gesture, with 360° GLB fallback.
 */
export default function CarArDemoPage() {
  const [mobileHandOff, setMobileHandOff] = useState(false);

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 1024px)").matches);
    if (mobile) {
      setMobileHandOff(true);
      // Native AR cannot reliably be launched from an embedded cross-origin iframe.
      // Top-level model-viewer offers its own AR button and 360° when unavailable.
      window.location.replace("/car-ar?source=car-ar-demo");
    }
  }, []);

  return (
    <main className="sfCarArDemo">
      <header className="sfCarArDemoTop">
        <Link className="sfCarArDemoBrand" href="/" aria-label="SOULFLAME CarAR — към E&A">
          <img src="/brand/ea-approved-1to1.jpg" width="98" height="62" alt="E&A East West Auctioneers Group" />
          <span className="sfCarArDemoIdentity">
            <span>SOULFLAME PRESENTS</span>
            <strong>Car<span>AR</span></strong>
          </span>
        </Link>
        <div className="sfCarArDemoLinks">
          <Link href="/car-ar">3D / 360° ↗</Link>
          <Link href="/">КЪМ E&amp;A ↗</Link>
        </div>
      </header>

      {mobileHandOff ? (
        <section className="sfCarArDemoRedirect" aria-live="polite">
          <h1>Отваряме CarAR</h1>
          <p>Телефонът ще използва WebXR, когато се поддържа, или 360° изглед.</p>
          <Link href="/car-ar">ОТВОРИ АВТОМОБИЛА ↗</Link>
        </section>
      ) : (
        <>
          <div className="sfCarArDemoHeading">
            <div>
              <span className="sfCarArDemoEyebrow">THE INTERACTIVE EXPERIENCE</span>
              <h1>Твоята кола. <em>Твоят цвят.</em></h1>
              <p>Разгледай оригиналната интерактивна 3D визуализация и смени цветовете директно в екрана.</p>
            </div>
            <span className="sfCarArDemoLive"><i /> INTERACTIVE 3D</span>
          </div>

          <div className="sfCarArDemoGrid">
            <section className="sfCarArDemoStage" aria-label="Интерактивен автомобил с избор на цветове">
              <iframe
                title="CarAR интерактивна 3D кола с цветове — оригинално Lusion Gemini демо"
                src="https://exp-gemini.lusion.co/motion"
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="autoplay; fullscreen; accelerometer; gyroscope; xr-spatial-tracking"
                allowFullScreen
              />
              <div className="sfCarArDemoStageLabel">INTERACTIVE COLORS · 3D</div>
            </section>

            <aside className="sfCarArDemoQR">
              <div className="sfCarArDemoQRCode">
                <span>SCAN FOR AR</span>
                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAACMAQAAAACGu3yTAAABAElEQVR42uWWsU0FQAxDnxG9swH7j/U3cCYwxYcGOkKDSBVdYTl2FJ/Kl9oXvtVff1pJO0iwkm7wbbxLJNrcsFbAW+Cj/THW69O7WHR+S0Kj3LFc8D7iwT3OKMgCDxD051i0bdO0/ugv+8XuMDtEmuXCK6HFcRvgxMsgEnYXn3aVhtZ2cIMvvGgdqBvHrW9YxdSQctOLxolDnzbkxivUJBC7V71MS2P3qldc25hefVRBgTfIWsF70st2KHbSq48FP9cCH31smxJC09zuhCTEYBZxz6HWFaacc2gHxmjmnh2G5RE390xjVY1Bl3v/mUNZs4uPM0qzGXAsfMDSP/h/vQOJcM0xnmZGVQAAAABJRU5ErkJggg==" width="176" height="176" alt="QR код за CarAR — https://enchev-auctions.vercel.app/car-ar" />
              </div>
              <h2>Премести автомобила в твоя свят.</h2>
              <p>Сканирай QR кода с телефона. Ако устройството поддържа AR, натисни „Постави колата в AR“. Ако не — върти колата свободно на 360°.</p>
              <Link className="sfCarArDemoAction" href="/car-ar">ОТВОРИ WEBXR / 360° ↗</Link>
              <span className="sfCarArDemoNote">AR е функция на устройството и браузъра. 360° е резервният режим.</span>
              <a className="sfCarArDemoCredit" href="https://exp-gemini.lusion.co/motion" target="_blank" rel="noopener noreferrer">Цветното 3D демо е Lusion Gemini ↗</a>
            </aside>
          </div>
          <footer className="sfCarArDemoFooter">
            <span>SOULFLAME · CarAR EXPERIENCE</span>
            <Link href="/3d-login/index.html">COMING SOON ↗</Link>
          </footer>
        </>
      )}
    </main>
  );
}
