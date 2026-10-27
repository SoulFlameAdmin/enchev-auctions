"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep a same-origin, interactive 3D car renderer hot behind the ENCHEV
 * introduction. The dialog appears only after the original ENTER action.
 * Existing buyer authentication and auctions are unaffected.
 */
export default function EnchevCinematicLoginGate() {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const requestedRef = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const requestOpen = useCallback(() => {
    requestedRef.current = true;
    if (readyRef.current) {
      setOpen(true);
      setHasOpened(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    requestedRef.current = false;
    setRevealed(false);
    setOpen(false);
    window.requestAnimationFrame(() => launcher.current?.focus());
  }, []);

  // The iframe stays mounted even while hidden, so the original .glb, textures
  // and the GPU scene load once — during the ENCHEV introduction.
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "ENCHEV_3D_MODEL_READY" ||
          event.data?.type === "ENCHEV_3D_MODEL_FAILED") {
        readyRef.current = true;
        if (requestedRef.current) {
          setOpen(true);
          setHasOpened(true);
        }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  // Only the original welcome ENTER triggers the modal, not initial page load.
  useEffect(() => {
    const forge = document.querySelector<HTMLIFrameElement>(
      'iframe[title="ENCHEV Auctions cinematic homepage"]'
    );
    if (!forge) return;

    let detachDocument: (() => void) | undefined;
    const attach = () => {
      detachDocument?.();
      let doc: Document | null = null;
      try { doc = forge.contentDocument; } catch { /* fail closed */ }
      if (!doc) return;
      const onForgeClick = (event: MouseEvent) => {
        let current = event.target as Element | null;
        for (let level = 0; current && level < 7; level++, current = current.parentElement) {
          const label = (current.textContent || current.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ").trim();
          if (/^ENTER(?:\s*[→↗›])?$/i.test(label)) {
            // Do not cancel the site's original cinematic ENTER action.
            window.requestAnimationFrame(requestOpen);
            return;
          }
        }
      };
      doc.addEventListener("click", onForgeClick, true);
      detachDocument = () => doc?.removeEventListener("click", onForgeClick, true);
    };
    forge.addEventListener("load", attach);
    attach();
    return () => {
      forge.removeEventListener("load", attach);
      detachDocument?.();
    };
  }, [requestOpen]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      setRevealed(true);
      frameRef.current?.contentWindow?.postMessage(
        { type: "ENCHEV_3D_SHOW" }, window.location.origin
      );
      closeButton.current?.focus();
    });
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, dismiss]);

  useEffect(() => {
    const onEnter = (event: KeyboardEvent) => {
      if (open || event.key !== "Enter" || event.repeat) return;
      const element = event.target as HTMLElement | null;
      if (element?.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      requestOpen();
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [open, requestOpen]);

  return (
    <>
      <div
        data-enchev-modal-backdrop
        aria-hidden={!open}
        inert={!open}
        onClick={(event) => { if (open && event.target === event.currentTarget) dismiss(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 2147483000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          background: open && revealed ? "rgba(0,0,0,.64)" : "rgba(0,0,0,0)",
          backdropFilter: open && revealed ? "blur(5px)" : "blur(0px)",
          WebkitBackdropFilter: open && revealed ? "blur(5px)" : "blur(0px)",
          transition: "background 700ms ease, backdrop-filter 700ms ease",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
        }}
      >
        <section
          role="dialog"
          aria-modal={open}
          aria-label="ENCHEV AUCTIONS — интерактивен 3D вход"
          style={{
            position: "relative",
            width: "min(1080px, calc(100vw - 32px))",
            height: "min(640px, calc(100dvh - 48px))",
            maxHeight: "calc(100dvh - 24px)",
            flexShrink: 0, overflow: "hidden", borderRadius: 16,
            border: "1px solid rgba(214,190,147,.4)",
            boxShadow: "0 30px 110px rgba(0,0,0,.85), 0 0 50px rgba(195,28,35,.12)",
            background: "#050608",
            opacity: open && revealed ? 1 : 0,
            transform: open && revealed ? "translateY(0) scale(1)" : "translateY(28px) scale(.94)",
            transition: "opacity 3s cubic-bezier(.2,.7,.2,1), transform 3s cubic-bezier(.2,.7,.2,1)",
          }}
        >
          <iframe
            ref={frameRef}
            src="/3d-login/index.html"
            title="ENCHEV AUCTIONS — автентичен Spectral GT RS GLB, дрифт и вход"
            loading="eager"
            style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#050608" }}
          />
          {open && (
            <button
              type="button"
              ref={closeButton}
              onClick={dismiss}
              aria-label="Затвори прозореца"
              title="Затвори"
              style={{
                position: "absolute", top: 12, right: 12, zIndex: 1,
                width: 44, height: 44, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,.45)",
                color: "#fff", background: "rgba(8,9,13,.82)",
                backdropFilter: "blur(12px)", cursor: "pointer",
                fontSize: 25, fontWeight: 300, lineHeight: 1,
              }}
            >×</button>
          )}
        </section>
      </div>
      {!open && hasOpened && (
        <button
          type="button"
          ref={launcher}
          onClick={requestOpen}
          aria-label="Отвори 3D автомобил и вход"
          style={{
            position: "fixed", bottom: "max(18px, env(safe-area-inset-bottom))",
            right: "max(18px, env(safe-area-inset-right))",
            zIndex: 2147482000,
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
