"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "enchev-custom-hero-background";

export default function BackgroundSwitcher() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hasCustom, setHasCustom] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        document.documentElement.style.setProperty("--custom-hero-bg", `url(${JSON.stringify(saved)})`);
        document.documentElement.classList.add("has-custom-hero-bg");
        setHasCustom(true);
      }
    } catch {}
  }, []);

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      try { localStorage.setItem(STORAGE_KEY, result); } catch {}
      document.documentElement.style.setProperty("--custom-hero-bg", `url(${JSON.stringify(result)})`);
      document.documentElement.classList.add("has-custom-hero-bg");
      setHasCustom(true);
      setOpen(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    document.documentElement.style.removeProperty("--custom-hero-bg");
    document.documentElement.classList.remove("has-custom-hero-bg");
    setHasCustom(false);
  };

  return (
    <div className="backgroundSwitcher">
      <button className="backgroundSwitcherToggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        ◩ <span>Фон</span>
      </button>
      {open && (
        <div className="backgroundSwitcherPanel">
          <b>Hero background</b>
          <small>Избери снимка от компютъра. Запазва се само в този браузър.</small>
          <button className="backgroundSwitcherPrimary" onClick={() => inputRef.current?.click()}>Избери снимка</button>
          {hasCustom && <button className="backgroundSwitcherReset" onClick={reset}>Върни оригиналния фон</button>}
        </div>
      )}
      <input ref={inputRef} className="backgroundSwitcherInput" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={chooseImage} />
    </div>
  );
}
