"use client";

import { useEffect } from "react";

type BlockConfig = {
  heading: string;
  description: string;
  href: string;
  cta: string;
};

const BLOCKS: Record<string, BlockConfig> = {
  Cohesion: {
    heading: "Търгувай",
    description: "Влез в търговете на живо, следи текущата цена и наддавай през EAuctions.",
    href: "/live-auctions",
    cta: "ВИЖ ТЪРГОВЕТЕ",
  },
  Insight: {
    heading: "Провери",
    description: "Провери историята на автомобила, VIN данните и ключовата информация преди покупка.",
    href: "/vehicle-history",
    cta: "ПРОВЕРИ АВТОМОБИЛ",
  },
  Identity: {
    heading: "За нас",
    description: "EAuctions by SoulFlame събира търгове, история, транспорт и поддръжка в една платформа.",
    href: "/presentation",
    cta: "НАУЧИ ПОВЕЧЕ",
  },
  Discovery: {
    heading: "Автомобили",
    description: "Разгледай наличния инвентар и открий автомобил по марка, модел, VIN или LOT.",
    href: "/inventory",
    cta: "ВИЖ АВТОМОБИЛИТЕ",
  },
  Inspection: {
    heading: "Регистрация",
    description: "Създай профил, за да запазваш автомобили, да участваш в търгове и да управляваш покупките си.",
    href: "/profile?view=register",
    cta: "РЕГИСТРИРАЙ СЕ",
  },
  Auctions: {
    heading: "Търгове на живо",
    description: "Следи активните търгове и текущите лотове в реално време.",
    href: "/live-auctions",
    cta: "ОТВОРИ ТЪРГОВЕТЕ",
  },
  History: {
    heading: "История на МПС",
    description: "Провери историята и наличните данни за автомобила преди решение.",
    href: "/vehicle-history",
    cta: "ПРОВЕРИ ИСТОРИЯ",
  },
  Transport: {
    heading: "Транспорт",
    description: "Организирай транспорт и проследявай следващите стъпки след покупката.",
    href: "/transport",
    cta: "ВИЖ ТРАНСПОРТА",
  },
  Support: {
    heading: "Поддръжка",
    description: "Получавай помощ за профил, търгове, автомобили, плащания и транспорт.",
    href: "/support",
    cta: "ПОЛУЧИ ПОМОЩ",
  },
};

const H2_TRANSLATIONS: Record<string, string> = {
  "We connect you with vehiclesYou choose your next one": "Свързваме те с автомобилите. Ти избираш следващия.",
  "Your Route To Your Next Vehicle": "Пътят към следващия ти автомобил",
  "A vehicle should say something before it moves. Every line, material, and finish is considered.": "Открий, провери и купи следващия си автомобил на едно място.",
  "Ends Here": "Всичко започва тук",
  "Vehicle Inventory": "Автомобили",
  "Live Auctions": "Търгове на живо",
  "Refuse Ordinary": "Избери различното",
};

const PARAGRAPH_TRANSLATIONS: Record<string, string> = {
  "Every decision is intentional, every detail has purpose based on your taste, your lifestyle, and your standards.": "Всяко действие в EAuctions е насочено към една цел: сигурна, прозрачна и лесна покупка на автомобил.",
  "A vehicle should say something before it moves. Every line, material, and finish is considered.": "Открий, провери и купи следващия си автомобил чрез една свързана платформа.",
  "Our services are shaped with intent, from exterior styling and interior refinement to performance upgrades, detailing and bespoke finishes; each detail sharpens the vehicle’s character without overpowering it.": "Всички ключови функции са събрани на едно място: автомобили, търгове, история на МПС, транспорт, профил и поддръжка.",
  "A collection of previous bespoke builds, shaped by craft, character and the people behind the wheel.": "Разгледай наличните автомобили и намери подходящия за теб.",
  "Builds available for purchase, refined with intent, engineered with purpose, and ready to make a statement.": "Следи активните търгове и участвай в наддаването.",
  "Vehicle auctions with inventory, live bidding, vehicle history and transport in one place.": "Автомобили, търгове на живо, история на МПС и транспорт на едно място.",
  "Service": "Услуга",
  "Are you ready to": "Готов ли си да",
};

const NAV_TRANSLATIONS: Record<string, { label: string; href: string }> = {
  Home: { label: "Начало", href: "/" },
  Builds: { label: "Автомобили", href: "/inventory" },
  Stock: { label: "Търгове", href: "/live-auctions" },
  Contact: { label: "Поддръжка", href: "/support" },
  Cookies: { label: "Регистрация", href: "/profile?view=register" },
  Privacy: { label: "История", href: "/vehicle-history" },
  Terms: { label: "Транспорт", href: "/transport" },
  Sitemap: { label: "Профил", href: "/profile" },
};

function setAnimatedLabel(anchor: HTMLAnchorElement, label: string) {
  const root = anchor.querySelector(":scope > span");
  if (!root) {
    anchor.textContent = label;
    return;
  }
  const doc = anchor.ownerDocument;
  root.replaceChildren(
    ...Array.from(label).map((char) => {
      const span = doc.createElement("span");
      span.textContent = char === " " ? "\u00a0" : char;
      return span;
    }),
  );
}

function setTopNavigation(anchor: HTMLAnchorElement, href: string, label?: string) {
  anchor.setAttribute("href", href);
  anchor.setAttribute("target", "_top");
  if (label) {
    setAnimatedLabel(anchor, label);
    anchor.setAttribute("aria-label", label);
  }
}

function applyBulgarianHome(doc: Document) {
  for (const heading of Array.from(doc.querySelectorAll("h3"))) {
    const original = heading.textContent?.trim() ?? "";
    const config = BLOCKS[original];
    if (!config) continue;

    const section = heading.closest("section");
    heading.textContent = config.heading;
    if (!section) continue;

    const description = Array.from(section.querySelectorAll("p")).find(
      (node) => (node.textContent?.trim().length ?? 0) > 40,
    );
    if (description) description.textContent = config.description;

    const cta = section.querySelector<HTMLAnchorElement>(
      'a[href*="/contact"], a[href*="/builds"], a[href*="/stock"]',
    );
    if (cta) setTopNavigation(cta, config.href, config.cta);
  }

  for (const heading of Array.from(doc.querySelectorAll("h2"))) {
    const original = heading.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const translation = H2_TRANSLATIONS[original];
    if (translation) heading.textContent = translation;
  }

  for (const paragraph of Array.from(doc.querySelectorAll("p"))) {
    const original = paragraph.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const translation = PARAGRAPH_TRANSLATIONS[original];
    if (translation) paragraph.textContent = translation;
  }

  for (const anchor of Array.from(doc.querySelectorAll<HTMLAnchorElement>("a"))) {
    const original = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const nav = NAV_TRANSLATIONS[original];
    if (nav) {
      setTopNavigation(anchor, nav.href, nav.label);
      continue;
    }

    if (anchor.getAttribute("href") === "/builds/") {
      setTopNavigation(anchor, "/inventory", "ВИЖ АВТОМОБИЛИТЕ");
    } else if (anchor.getAttribute("href") === "/stock/") {
      setTopNavigation(anchor, "/inventory", "РАЗГЛЕДАЙ ИНВЕНТАРА");
    } else if (
      anchor.getAttribute("href") === "/contact/" &&
      /start your project/i.test(original)
    ) {
      setTopNavigation(anchor, "/profile?view=register", "РЕГИСТРАЦИЯ");
    } else if (original === "Skip to content") {
      anchor.textContent = "Към съдържанието";
    }
  }

  doc.documentElement.setAttribute("lang", "bg");
}

export default function ForgeBulgarianHomeBridge() {
  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>("#ea-forge-home");
    if (!iframe) return;

    let timer: number | undefined;
    let attempts = 0;

    const apply = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.body) return false;
        applyBulgarianHome(doc);
        return true;
      } catch {
        return false;
      }
    };

    const retry = () => {
      if (apply() || attempts >= 40) return;
      attempts += 1;
      timer = window.setTimeout(retry, 250);
    };

    iframe.addEventListener("load", retry);
    retry();

    return () => {
      iframe.removeEventListener("load", retry);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
