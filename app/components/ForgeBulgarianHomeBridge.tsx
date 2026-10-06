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
    heading: "ТЪРГУВАЙ",
    description: "Влез директно в търговете на живо, следи текущия лот и наддавай през реалната EAuctions система.",
    href: "/live-auctions",
    cta: "ОТВОРИ ТЪРГОВЕТЕ",
  },
  Insight: {
    heading: "КУПИ",
    description: "Разгледай реалния каталог, търси по марка, модел, VIN или LOT и отвори детайлите на автомобила.",
    href: "/inventory",
    cta: "РАЗГЛЕДАЙ АВТОМОБИЛИТЕ",
  },
  Identity: {
    heading: "ДОКУМЕНТИ И ТРАНСПОРТ",
    description: "След покупката управлявай транспорта, доставката и свързаните документи в един ясен процес.",
    href: "/transport",
    cta: "ДОКУМЕНТИ И ТРАНСПОРТ",
  },
  Discovery: {
    heading: "ПРОВЕРИ",
    description: "Провери VIN, историята на автомобила, статуса и наличната информация преди да вземеш решение.",
    href: "/vehicle-history",
    cta: "ПРОВЕРИ АВТОМОБИЛ",
  },
  Inspection: {
    heading: "ЗА НАС",
    description: "Виж как EAuctions by SoulFlame свързва автомобилите, търговете, проверките, документите и транспорта.",
    href: "/presentation",
    cta: "НАУЧИ ПОВЕЧЕ",
  },
  Auctions: {
    heading: "ТЪРГОВЕ НА ЖИВО",
    description: "Следи активните търгове, текущите лотове, цената и наддаването в реално време.",
    href: "/live-auctions",
    cta: "КЪМ LIVE ТЪРГОВЕТЕ",
  },
  History: {
    heading: "ИСТОРИЯ НА МПС",
    description: "Направи проверка на VIN и виж наличните данни за автомобила преди покупка.",
    href: "/vehicle-history",
    cta: "ПРОВЕРИ VIN",
  },
  Transport: {
    heading: "ДОСТАВКА И ДОКУМЕНТИ",
    description: "Провери ориентировъчния маршрут, транспортния процес и документите след спечелен автомобил.",
    href: "/transport",
    cta: "ОТВОРИ ТРАНСПОРТА",
  },
  Support: {
    heading: "ПОДДРЪЖКА",
    description: "Получавай помощ за профил, търгове, автомобили, плащания, документи и транспорт.",
    href: "/support",
    cta: "ПОЛУЧИ ПОМОЩ",
  },
};

const H2_TRANSLATIONS: Record<string, string> = {
  "We connect you with vehiclesYou choose your next one": "Избираш автомобил. Ние свързваме целия процес.",
  "Your Route To Your Next Vehicle": "Твоят път към следващия автомобил",
  "A vehicle should say something before it moves. Every line, material, and finish is considered.": "Търгове, автомобили, проверки, документи и транспорт в една система.",
  "Ends Here": "Всичко започва тук",
  "Vehicle Inventory": "Автомобили",
  "Live Auctions": "Търгове на живо",
  "Refuse Ordinary": "Избери следващия си автомобил",
};

const PARAGRAPH_TRANSLATIONS: Record<string, string> = {
  "Every decision is intentional, every detail has purpose based on your taste, your lifestyle, and your standards.": "EAuctions води клиента от откриването на автомобила до търга, проверката, документите и транспорта.",
  "A vehicle should say something before it moves. Every line, material, and finish is considered.": "Открий, провери и купи следващия си автомобил чрез една свързана платформа.",
  "Our services are shaped with intent, from exterior styling and interior refinement to performance upgrades, detailing and bespoke finishes; each detail sharpens the vehicle’s character without overpowering it.": "Всички ключови функции са на едно място: каталог, търгове на живо, история на МПС, документи, транспорт, профил и поддръжка.",
  "A collection of previous bespoke builds, shaped by craft, character and the people behind the wheel.": "Разгледай наличните автомобили и отвори реалния каталог.",
  "Builds available for purchase, refined with intent, engineered with purpose, and ready to make a statement.": "Следи активните търгове и участвай в наддаването.",
  "Vehicle auctions with inventory, live bidding, vehicle history and transport in one place.": "Автомобили, търгове на живо, история на МПС, документи и транспорт на едно място.",
  "Service": "Услуга",
  "Are you ready to": "Готов ли си да",
};

const NAV_TRANSLATIONS: Record<string, { label: string; href: string }> = {
  Home: { label: "Начало", href: "/" },
  Builds: { label: "Купи", href: "/inventory" },
  Stock: { label: "Търгувай", href: "/live-auctions" },
  Contact: { label: "Поддръжка", href: "/support" },
  Cookies: { label: "Регистрация", href: "/profile?view=register" },
  Privacy: { label: "Провери", href: "/vehicle-history" },
  Terms: { label: "Документи и транспорт", href: "/transport" },
  Sitemap: { label: "За нас", href: "/presentation" },
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
      setTopNavigation(anchor, "/inventory", "КУПИ");
    } else if (anchor.getAttribute("href") === "/stock/") {
      setTopNavigation(anchor, "/live-auctions", "ТЪРГУВАЙ");
    } else if (
      anchor.getAttribute("href") === "/contact/" &&
      /start your project/i.test(original)
    ) {
      setTopNavigation(anchor, "/presentation", "ЗА НАС");
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
