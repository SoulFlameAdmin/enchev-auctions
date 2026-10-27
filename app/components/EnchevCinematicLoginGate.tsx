"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Isolated visual gate: does not change auctions, sessions or API logic.
 * The interactive car lives inside its own document to avoid clashing with Forge CSS.
 */
export default function EnchevCinematicLoginGate() {
  const [open, setOpen] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => setRevealed(true));
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRevealed(false);
        setOpen(false);
        window.requestAnimationFrame(() => launcher.current?.focus());
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    const onEnter = (event: KeyboardEvent) => {
      if (open || event.key !== "Enter" || event.repeat) return;
      const element = event.target as HTMLElement | null;
      if (element?.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      setRevealed(false);
      setOpen(true);
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [open]);

  const launch = () => {
    setRevealed(false);
    setOpen(true);
  };
  const dismiss = () => {
    setRevealed(false);
    setOpen(false);
    window.requestAnimationFrame(() => launcher.current?.focus());
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ENCHEV AUCTIONS — interactive 3D access"
          style={{
            position: "fixed", inset: 0, zIndex: 2147483000,
            background: "#030405",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "scale(1)" : "scale(1.035)",
            transition: "opacity 3s cubic-bezier(.2,.7,.2,1), transform 3s cubic-bezier(.2,.7,.2,1)",
            pointerEvents: "auto",
          }}
        >
          <iframe
            src="/3d-login/index.html"
            title="ENCHEV AUCTIONS — 3D car with gas, drift and smoke; secure login"
            style={{ display: "block", width: "100%", height: "100dvh", border: 0, background: "#050608" }}
            allow="fullscreen"
          />
          <button
            type="button"
            ref={closeButton}
            onClick={dismiss}
            aria-label="Затвори 3D екрана и виж началната страница"
            title="Close / Затвори"
            style={{
              position: "absolute", top: "max(14px, env(safe-area-inset-top))", right: "max(14px, env(safe-area-inset-right))",
              zIndex: 2147483001, width: 48, height: 48, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,.4)", color: "#fff",
              background: "rgba(8,9,13,.85)", backdropFilter: "blur(12px)",
              cursor: "pointer", fontSize: 25, fontWeight: 300, lineHeight: 1,
            }}
          >×</button>
        </div>
      )}
      {!open && (
        <button
          type="button"
          ref={launcher}
          onClick={launch}
          aria-label="Отвори 3D автомобил и вход"
          style={{
            position: "fixed", bottom: "max(18px, env(safe-area-inset-bottom))",
            right: "max(18px, env(safe-area-inset-right))", zIndex: 2147482000,
            border: "1px solid #ad8b5a", background: "rgba(8,10,13,.95)",
            color: "#ebd4a8", cursor: "pointer", padding: "13px 17px",
            fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
            boxShadow: "0 8px 30px #0008", borderRadius: 4,
          }}
        >3D ВХОД ↗</button>
      )}
    </>
  );
}
