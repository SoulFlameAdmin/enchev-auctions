"use client";

import { useEffect } from "react";

const PHASE_BG: Record<string, string> = {
  "System definition & invariants": "Дефиниране на системата и основни правила",
  "Clean foundation": "Чиста основа на проекта",
  "Architecture & repository": "Архитектура и структура на хранилището",
  "Database & data integrity": "База данни и цялост на данните",
  "Identity & access": "Идентичност и контрол на достъпа",
  "KYC / KYB / eligibility": "KYC / KYB / право на участие",
  "Vehicle inventory": "Автомобили и инвентар",
  "Marketplace & discovery": "Пазар, обяви и откриване",
  "Auction configuration": "Конфигурация на търговете",
  "Pre-Bid & Max Bid engine": "Предварително и максимално наддаване",
  "Live realtime auction": "Live търг в реално време",
  "Finalization & winner": "Приключване на търга и победител",
  "Notifications": "Известия",
  "Release, pickup & logistics": "Освобождаване, получаване и логистика",
  "Admin & operations": "Администрация и операции",
  "Legal, privacy & transparency": "Правни изисквания, поверителност и прозрачност",
  "Security hardening": "Засилване на сигурността",
  "Observability & recovery": "Наблюдаемост и възстановяване",
  "Load, concurrency & chaos": "Натоварване, едновременност и chaos тестове",
  "Closed pilot": "Затворен пилотен тест",
  "Production providers": "Production доставчици и външни услуги",
  "International readiness": "Готовност за международна работа",
  "AI-assisted features": "Функции с AI помощ",
  "Production launch & ongoing engineering": "Production пускане и постоянна поддръжка",
  "API & contracts": "API и договори между системите",
  "Testing strategy": "Стратегия за тестване",
  "CI/CD & software supply chain": "CI/CD и сигурност на софтуерната верига",
  "SLO, capacity & resilience": "SLO, капацитет и устойчивост",
  "Accessibility & device quality": "Достъпност и качество на различни устройства",
  "Data lifecycle & privacy engineering": "Жизнен цикъл на данните и privacy engineering",
  "Operational readiness": "Оперативна готовност",
  "International expansion validation": "Проверка на международното разширяване",
  "Master plan governance": "Управление на основния план",
  "Buyer workspace, watchlist & alerts": "Работно пространство на купувача, списък и известия",
  "Vehicle inspection intelligence": "Инспекция и интелигентен анализ на автомобила",
  "Seller listing workflow & Q&A": "Процес за обяви на продавача и въпроси/отговори",
  "Professional live-auction UX": "Професионален интерфейс за live търг",
  "Auction trust record & reconstruction": "Доказуема история и възстановяване на търга",
  "Search, discovery & personalization": "Търсене, откриване и персонализация",
  "Real international proof": "Реално доказателство за международна работа",
  "Production failure certification": "Production сертификация при откази",
  "Security & abuse certification": "Сертификация за сигурност и злоупотреби",
  "Performance certification": "Сертификация на производителността",
  "Recovery certification": "Сертификация за възстановяване",
  "Closed production pilot": "Затворен production пилот",
  "Controlled public launch": "Контролирано публично пускане",
  "International production launch": "Международно production пускане",
  "FINAL SYSTEM ACCEPTANCE — 100%": "ФИНАЛНО ПРИЕМАНЕ НА СИСТЕМАТА — 100%",
  "Infrastructure as Code, DNS, TLS & edge": "Infrastructure as Code, DNS, TLS и edge инфраструктура",
  "Secure data, files & key management": "Сигурни данни, файлове и управление на ключове",
  "Event, queue & worker correctness": "Коректност на събития, опашки и workers",
  "Database HA, time authority & zero-downtime data operations": "HA база данни, авторитетно време и операции без прекъсване",
  "Identity assurance, sessions & privileged access": "Надеждна идентичност, сесии и привилегирован достъп",
  "Auction fraud, abuse & emergency controls": "Измами, злоупотреби и аварийни контроли при търговете",
  "Privacy, regulatory & marketplace compliance operations": "Поверителност, регулации и съответствие на marketplace-а",
  "Provider & third-party runtime governance": "Управление на доставчици и външни услуги",
  "Frontend performance, RUM, international SEO & accessibility proof": "Frontend производителност, RUM, международно SEO и доказана достъпност",
  "Messaging integrity & deliverability": "Надеждност и доставяемост на съобщенията",
  "Software supply-chain, artifact & license trust": "Софтуерна верига, артефакти и лицензна надеждност",
  "Organization accounts & delegated access": "Организационни профили и делегиран достъп",
  "Yard, document & physical chain-of-custody operations": "Паркинги, документи и физическа верига на отговорност",
  "Auction events, lanes & auctioneer operations": "Търгови събития, линии и операции на аукциониста"
};

const WAVE_BG: Record<string, string> = {
  "Definition & governance": "Дефиниране и управление",
  "Engineering foundation & cross-cutting design": "Инженерна основа и общ системен дизайн",
  "Core data & reliability infrastructure": "Основни данни и надеждна инфраструктура",
  "Identity, security & compliance foundations": "Идентичност, сигурност и съответствие",
  "Vehicle, seller & physical domain": "Автомобили, продавачи и физически операции",
  "Authoritative auction core": "Авторитетно ядро на търга",
  "Realtime, events & communications": "Realtime, събития и комуникации",
  "Product, admin, search & trust surfaces": "Продукт, администрация, търсене и доверие",
  "International, accessibility & frontend proof": "Международност, достъпност и frontend доказателства",
  "Hardening, security & load certification": "Засилване, сигурност и сертификация при натоварване",
  "SLO, operations & recovery certification": "SLO, операции и сертификация за възстановяване",
  "Closed pre-production pilot": "Затворен pre-production пилот",
  "Production readiness & closed production pilot": "Production готовност и затворен production пилот",
  "Controlled public launch": "Контролирано публично пускане",
  "International production expansion & advanced features": "Международно production разширяване и разширени функции",
  "Final system acceptance": "Финално приемане на системата"
};

function translateText(value: string) {
  let out = value;
  for (const [from, to] of Object.entries(PHASE_BG)) out = out.replace(from, to);
  for (const [from, to] of Object.entries(WAVE_BG)) out = out.replace(from, to);
  return out;
}

export default function BulgarianStageLabels() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLElement>(".phaseHead b, .phaseHead small, .nextCard b").forEach((el) => {
        const current = el.textContent || "";
        const translated = translateText(current);
        if (translated !== current) el.textContent = translated;
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
