"use client";

import { useEffect } from "react";

/**
 * The Forge cinematic scrolls inside a same-origin iframe while the E&A
 * masthead is fixed in the parent. Mask the masthead as the stitching-photo
 * section physically passes over it, rather than leaving the logo above it.
 *
 * The photo and the approved 1:1 logo assets are never changed.
 */
export default function EaHeroPhotoOcclusion() {
  useEffect(() => {
    const brand = document.querySelector<HTMLElement>(".eaHeroBrand");
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[title="ENCHEV Auctions cinematic homepage"]'
    );

    if (!brand || !frame) return;

    let frameWindow: Window | null = null;
    let frameDocument: Document | null = null;
    let photoSection: Element | null = null;
    let frameId = 0;

    const update = () => {
      frameId = 0;
      if (!brand.isConnected || !frameDocument) return;

      if (!photoSection?.isConnected) {
        // The specific section shown in the screenshot: hands stitching
        // leather + "Your Route To Your Next Vehicle".
        photoSection = frameDocument
          .querySelector('[data-sanity*="path=approachHeading"]')
          ?.closest("section") ?? null;
      }

      if (!photoSection) return;

      const brandRect = brand.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const photoTop = frameRect.top + photoSection.getBoundingClientRect().top;

      // When the photograph touches the bottom of the logo, mask its bottom.
      // The more the photo moves upward, the more of the logo disappears.
      // Scrolling back restores the logo naturally, without a state toggle.
      const hiddenPx = Math.max(
        0,
        Math.min(brandRect.height, brandRect.bottom - photoTop)
      );
      const clip = `inset(0px 0px ${Math.ceil(hiddenPx)}px 0px)`;
      if (brand.style.clipPath !== clip) {
        brand.style.clipPath = clip;
      }
    };

    const schedule = () => {
      if (!frameId) frameId = window.requestAnimationFrame(update);
    };

    const detach = () => {
      frameWindow?.removeEventListener("scroll", schedule);
      frameDocument?.removeEventListener("scroll", schedule, true);
      frameDocument?.removeEventListener("touchmove", schedule);
      frameWindow = null;
      frameDocument = null;
      photoSection = null;
    };

    const attach = () => {
      detach();
      try {
        frameWindow = frame.contentWindow;
        frameDocument = frame.contentDocument;
      } catch {
        // Only same-origin Forge documents support geometry-based masking.
      }
      if (!frameWindow || !frameDocument) return;

      frameWindow.addEventListener("scroll", schedule, { passive: true });
      frameDocument.addEventListener("scroll", schedule, true);
      frameDocument.addEventListener("touchmove", schedule, { passive: true });
      schedule();
    };

    frame.addEventListener("load", attach);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    attach();

    return () => {
      frame.removeEventListener("load", attach);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      detach();
      if (frameId) window.cancelAnimationFrame(frameId);
      brand.style.clipPath = "";
    };
  }, []);

  return null;
}
