"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "./enchev-pwa.css";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = Readonly<{
  installed: boolean;
  canPrompt: boolean;
  updateReady: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  applyUpdate: () => void;
}>;

const PwaContext = createContext<PwaContextValue | null>(null);
const VERSION_KEY = "ea-auctions-pwa-release-v1";

export function useEnchevPwa(): PwaContextValue {
  const value = useContext(PwaContext);
  if (!value) throw new Error("useEnchevPwa must be called within EnchevPwaProvider");
  return value;
}

function installedMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function EnchevPwaProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [workerWaiting, setWorkerWaiting] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const promptRef = useRef<InstallEvent | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadOnControllerChange = useRef(false);

  const versionCheck = useCallback(async () => {
    try {
      const response = await fetch("/api/pwa-version", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json() as {version?: unknown};
      if (typeof data.version !== "string" || data.version === "unversioned" || !/^[a-zA-Z0-9._-]{7,80}$/.test(data.version)) return;
      const known = window.localStorage.getItem(VERSION_KEY);
      if (known && known !== data.version) setNewVersion(data.version);
      else if (!known) window.localStorage.setItem(VERSION_KEY,data.version);
    } catch {
      // App stays usable when offline or version endpoint is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const refreshMode = () => setInstalled(installedMode());
    refreshMode();
    media.addEventListener?.("change", refreshMode);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallEvent;
      setCanPrompt(true);
    };
    const appInstalled = () => { promptRef.current = null; setCanPrompt(false); setInstalled(true); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(reg => {
          registrationRef.current = reg;
          if (reg.waiting && navigator.serviceWorker.controller) setWorkerWaiting(true);
          const onUpdateFound = () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) setWorkerWaiting(true);
            });
          };
          reg.addEventListener("updatefound", onUpdateFound);
          void reg.update().catch(() => {});
        })
        .catch(() => { /* Browser lacks service worker registration access */ });
    }

    const onControllerChange = () => {
      if (reloadOnControllerChange.current) {
        reloadOnControllerChange.current = false;
        window.location.reload();
      }
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    void versionCheck();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void versionCheck();
        void registrationRef.current?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const periodic = window.setInterval(() => { if (document.visibilityState === "visible") void versionCheck(); }, 15 * 60 * 1000);

    return () => {
      media.removeEventListener?.("change", refreshMode);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(periodic);
    };
  }, [versionCheck]);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const event = promptRef.current;
    if (!event) return "unavailable";
    promptRef.current = null;setCanPrompt(false);
    try {
      await event.prompt();
      const result = await event.userChoice;
      return result.outcome;
    } catch {
      return "unavailable";
    }
  }, []);

  const applyUpdate = useCallback(() => {
    if (newVersion) {
      try { localStorage.setItem(VERSION_KEY, newVersion); } catch { /* private mode */ }
    }
    if (workerWaiting && registrationRef.current?.waiting) {
      reloadOnControllerChange.current = true;
      registrationRef.current.waiting.postMessage({type:"SKIP_WAITING"});
      return;
    }
    window.location.reload();
  }, [workerWaiting,newVersion]);

  const value = useMemo<PwaContextValue>(() => ({
    installed, canPrompt, updateReady: workerWaiting || Boolean(newVersion),
    promptInstall, applyUpdate,
  }), [installed,canPrompt,workerWaiting,newVersion,promptInstall,applyUpdate]);

  const isAppPage = pathname === "/app" || pathname.startsWith("/app/");
  const hiddenRoutes = pathname === "/" || pathname.startsWith("/car-ar") ||
    pathname.startsWith("/early-access-admin") || pathname.startsWith("/owner-questions") ||
    pathname.startsWith("/auction-readiness") || pathname.startsWith("/offline");
  const showBottom = (installed || isAppPage) && !hiddenRoutes;
  const navItems = [
    {href:"/app",icon:"⌂",label:"Начало",match:pathname === "/app" || pathname === "/app/install"},
    {href:"/inventory",icon:"▤",label:"Автомобили",match:pathname.startsWith("/inventory") || pathname.startsWith("/lot/")},
    {href:"/live-auctions",icon:"◉",label:"LIVE демо",match:pathname.startsWith("/live-auctions")},
    {href:"/profile",icon:"♧",label:"Профил",match:pathname.startsWith("/profile") || pathname.startsWith("/login") || pathname.startsWith("/register")},
    {href:"/app/install",icon:"↓",label:"Приложение",match:false},
  ];

  return <PwaContext.Provider value={value}>
    {children}
    {showBottom && <nav className="eaPwaBottomNav" aria-label="Мобилно приложение E&A">
      {navItems.map((item,index)=><a href={item.href} key={item.href}
        className={index===2?"eaPwaNavLive":undefined}
        aria-current={item.match?"page":undefined}>
        <span className="eaPwaNavIcon" aria-hidden="true">{item.icon}</span>
        <small>{item.label}</small>
      </a>)}
    </nav>}
    {(workerWaiting || Boolean(newVersion)) && <aside className="eaPwaUpdateBanner" role="status" aria-live="polite">
      <div><strong>Нова версия на E&A Auctions</strong><span>Обнови приложението без ново инсталиране. Завърши текущите си действия преди това.</span></div>
      <button type="button" onClick={applyUpdate}>Обнови</button>
    </aside>}
  </PwaContext.Provider>;
}
