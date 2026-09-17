"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "enchev-custom-hero-background";

function applyBackground(value: string) {
  const hero = document.getElementById("top");
  if (!hero) return;
  hero.style.setProperty("background-image", `url(${JSON.stringify(value)})`, "important");
  hero.style.setProperty("background-size", "cover", "important");
  hero.style.setProperty("background-position", "center center", "important");
  hero.style.setProperty("background-repeat", "no-repeat", "important");
}

export default function BackgroundSwitcher() {
  const pathname=usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hasCustom, setHasCustom] = useState(false);

  useEffect(() => {
    if(pathname!=="/")return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        applyBackground(saved);
        setHasCustom(true);
      }
    } catch {}
  }, [pathname]);

  if(pathname!=="/")return null;

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      applyBackground(result);
      try { localStorage.setItem(STORAGE_KEY, result); } catch {}
      setHasCustom(true);
      setOpen(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    const hero = document.getElementById("top");
    if (hero) {
      hero.style.removeProperty("background-image");
      hero.style.removeProperty("background-size");
      hero.style.removeProperty("background-position");
      hero.style.removeProperty("background-repeat");
    }
    setHasCustom(false);
  };

  return (
    <div className="backgroundSwitcher">
      <button className="backgroundSwitcherToggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        ◩ <span>Фон</span>
      </button>
      {open && (
        <div className="backgroundSwitcherPanel">
          <b>Смяна на фона</b>
          <small>Качи PNG/JPG/WebP и снимката веднага ще стане фон на голямата hero секция.</small>
          <button className="backgroundSwitcherPrimary" onClick={() => inputRef.current?.click()}>Качи снимка</button>
          {hasCustom && <button className="backgroundSwitcherReset" onClick={reset}>Върни оригиналния фон</button>}
        </div>
      )}
      <input ref={inputRef} style={{ display: "none" }} type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={chooseImage} />
    </div>
  );
}
