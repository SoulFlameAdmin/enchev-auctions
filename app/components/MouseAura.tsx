"use client";

import { useEffect } from "react";

export default function MouseAura() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let frame = 0;

    const setPoint = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--mx", `${x}px`);
        root.style.setProperty("--my", `${y}px`);
      });
    };

    const onMove = (event: PointerEvent) => setPoint(event.clientX, event.clientY);
    const onLeave = () => setPoint(window.innerWidth * 0.72, 260);

    setPoint(window.innerWidth * 0.72, 260);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <div className="mouseAura" aria-hidden="true" />;
}
