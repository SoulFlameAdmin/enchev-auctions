"use client";

import Link from "next/link";
import { useState } from "react";
import { useEnchevPwa } from "../../components/EnchevPwaProvider";
import "../mobile-app.css";

export default function EnchevAppInstall() {
  const {installed,canPrompt,promptInstall,updateReady,applyUpdate} = useEnchevPwa();
  const [message,setMessage] = useState("");

  async function install() {
    if (!canPrompt) {
      setMessage("Използвай указанията по-долу от менюто на браузъра. На iPhone инсталирането е през „Сподели“.");
      document.getElementById("eaInstallInstructions")?.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    const result = await promptInstall();
    setMessage(result==="accepted"
      ? "Потвърдена е заявката за инсталиране. Провери началния екран на телефона."
      : result==="dismissed"
        ? "Инсталирането е отказано. Можеш да опиташ по-късно от менюто на браузъра."
        : "Браузърът не предложи директно инсталиране. Използвай указанията по-долу.");
  }

  return <main id="main-content" className="eaMobileApp eaInstallPage">
    <div className="eaMobileInner">
      <header className="eaMobileHeader">
        <Link href="/app" className="eaMobileLogo"><img src="/brand/ea-2026-app.svg" alt="E&A" width={50} height={50}/><span><strong>E&A AUCTIONS</strong><small>MOBILE APP</small></span></Link>
        <Link href="/app" className="eaInstallClose" aria-label="Към приложението">×</Link>
      </header>

      <section className="eaInstallHero">
        <span className="eaMobileEyebrow">E&A · ТВОЕТО ПРИЛОЖЕНИЕ</span>
        <div className="eaInstallIcon"><img src="/brand/ea-2026-app.svg" alt="E&A Auctions" width={124} height={124}/></div>
        <h1>{installed?"E&A вече е на телефона ти.":"Инсталирай E&A Auctions."}</h1>
        <p>{installed
          ?"Използвай приложението от иконата на началния екран. Новите версии се получават през уебсайта."
          :"Без магазин, без APK и без допълнителни настройки. Добави истинско уеб приложение с икона на телефона."}</p>
        <button type="button" onClick={install} disabled={installed} className="eaInstallPrimary">
          {installed?"✓ ПРИЛОЖЕНИЕТО Е ИНСТАЛИРАНО":canPrompt?"↓ ИНСТАЛИРАЙ СЕГА":"↓ КАК ДА ИНСТАЛИРАМ"} 
        </button>
        {message&&<p role="status" className="eaInstallMessage">{message}</p>}
        <Link href="/app" className="eaInstallPreview">Отвори мобилното приложение ↗</Link>
      </section>

      <section className="eaInstallInstructions" id="eaInstallInstructions">
        <div className="eaMobileSectionHead"><div><small>ИНСТРУКЦИИ</small><h2>Инсталиране от телефона</h2></div></div>
        <div className="eaInstallInstructionsGrid">
          <article>
            <span className="eaInstallDevice">ANDROID · CHROME</span>
            <h3>Добави приложението</h3>
            <ol><li>Отвори този адрес в Chrome.</li><li>Натисни „Инсталирай“ отгоре или менюто ⋮ в браузъра.</li><li>Избери „Инсталирай приложението“ / „Добави на началния екран“ и потвърди.</li></ol>
          </article>
          <article>
            <span className="eaInstallDevice">IPHONE · IOS</span>
            <h3>Добави на началния екран</h3>
            <ol><li>Отвори сайта в браузъра си.</li><li>Натисни „Сподели“ (квадрат със стрелка).</li><li>Избери „Добави на начален екран“ и потвърди.</li></ol>
          </article>
        </div>
      </section>
      <section className="eaInstallUpdates">
        <div><span className="eaMobileEyebrow">UPDATES · БЕЗ ПОВТОРНА ИНСТАЛАЦИЯ</span><h2>Обновяваме приложението вместо теб.</h2><p>При следващо отваряне приложението зарежда актуалната версия от сайта. Ако има нова версия, докато си вътре, можеш да я приложиш с „Обнови“ без повторно инсталиране. Не прекъсваме активно наддаване автоматично.</p></div>
        <button type="button" disabled={!updateReady} onClick={applyUpdate}>{updateReady?"Обнови сега":"Няма чакащо обновяване"}</button>
      </section>
      <div className="eaMobileDemoNotice"><span aria-hidden="true">ⓘ</span><p>Инсталирането не активира реална търговия. За участие се изискват регистрация, достъп и готова аукционна инфраструктура.</p></div>
      <footer className="eaMobileFooter">E&A East West Auctioneers Group · Powered by SoulFlame</footer>
    </div>
  </main>;
}
