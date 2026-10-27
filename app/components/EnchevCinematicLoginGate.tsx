"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A centered, dismissible 3D login preview over the unchanged ENCHEV homepage.
 * No authentication, auction, session or payment logic is changed here.
 */
export default function EnchevCinematicLoginGate() {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // The welcome "ENTER" control is rendered inside the same-origin Forge iframe.
  // Only open this overlay after the visitor actually activates that control.
  useEffect(() => {
    const forge = document.querySelector<HTMLIFrameElement>(
      'iframe[title="ENCHEV Auctions cinematic homepage"]'
    );
    if (!forge) return;

    let detachDocument: (() => void) | undefined;
    const attach = () => {
      detachDocument?.();
      let doc: Document | null = null;
      try {
        doc = forge.contentDocument;
      } catch {
        // Fail closed rather than showing the popup on initial load.
      }
      if (!doc) return;

      const onForgeClick = (event: MouseEvent) => {
        let current = event.target as Element | null;
        for (let level = 0; current && level < 7; level++, current = current.parentElement) {
          const label = (current.textContent || current.getAttribute("aria-label") || "")
            .replace(/\\s+/g, " ").trim();
          if (/^ENTER(?:\\s*[→↗›])?$/i.test(label)) {
            // Leave the original Forge ENTER handler intact.
            window.requestAnimationFrame(() => {
              setRevealed(false);
              setOpen(true);
            });
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
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => setRevealed(true));
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRevealed(false);
        setOpen(false);
        window.requestAnimationFrame(() => launcher.current?.focus());
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEscape);
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
          data-enchev-modal-backdrop
          onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483000,
            background: revealed ? "rgba(0, 0, 0, .64)" : "rgba(0, 0, 0, 0)",
            backdropFilter: revealed ? "blur(5px)" : "blur(0)",
            WebkitBackdropFilter: revealed ? "blur(5px)" : "blur(0)",
            transition: "background 700ms ease, backdrop-filter 700ms ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="ENCHEV AUCTIONS — интерактивен 3D вход"
            style={{
              position: "relative",
              width: "min(1080px, calc(100vw - 32px))",
              height: "min(640px, calc(100dvh - 48px))",
              maxHeight: "calc(100dvh - 24px)",
              flexShrink: 0,
              overflow: "hidden",
              borderRadius: 16,
              border: "1px solid rgba(214, 190, 147, .4)",
              boxShadow: "0 30px 110px rgba(0, 0, 0, .85), 0 0 50px rgba(195, 28, 35, .12)",
              background: "#050608",
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0) scale(1)" : "translateY(28px) scale(.94)",
              transition: "opacity 3s cubic-bezier(.2,.7,.2,1), transform 3s cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <iframe
              src="/3d-login/index.html"
              title="ENCHEV AUCTIONS — 3D автомобил с газ, дрифт, дим и защитен вход"
              style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#050608" }}
              allow="fullscreen"
            />
            <button
              type="button"
              ref={closeButton}
              onClick={dismiss}
              aria-label="Затвори прозореца"
              title="Затвори"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 1,
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "1px solid rgba(255, 255, 255, .45)",
                color: "#fff",
                background: "rgba(8, 9, 13, .82)",
                backdropFilter: "blur(12px)",
                cursor: "pointer",
                fontSize: 25,
                fontWeight: 300,
                lineHeight: 1,
              }}
            >×</button>
          </section>
        </div>
      )}
      {!open && (
        <button
          type="button"
          ref={launcher}
          onClick={launch}
          aria-label="Отвори 3D автомобил и вход"
          style={{
            position: "fixed",
            bottom: "max(18px, env(safe-area-inset-bottom))",
            right: "max(18px, env(safe-area-inset-right))",
            zIndex: 2147482000,
            border: "1px solid #ad8b5a",
            background: "rgba(8,10,13,.95)",
            color: "#ebd4a8",
            cursor: "pointer",
            padding: "13px 17px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".1em",
            boxShadow: "0 8px 30px #0008",
            borderRadius: 4,
          }}
        >3D ВХОД ↗</button>
      )}
    </>
  );
}
