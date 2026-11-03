import Link from "next/link";
import "./mobile-app.css";

export const metadata = {
  title: "E&A Auctions · Мобилно приложение",
  description: "E&A Auctions като приложение на телефона — каталог, демо търгове и личен профил.",
};

const tools = [
  { title:"Автомобили",subtitle:"Разгледай наличните предложения",icon:"▤",href:"/inventory",tag:"КАТАЛОГ" },
  { title:"LIVE търгове",subtitle:"Виж как работи наддаването",icon:"◉",href:"/live-auctions",tag:"ДЕМО" },
  { title:"Моят профил",subtitle:"Вход и регистрация",icon:"♙",href:"/profile",tag:"ПРОФИЛ" },
  { title:"Транспорт",subtitle:"Заявки и информация",icon:"↗",href:"/transport",tag:"УСЛУГИ" },
] as const;

export default function MobileAppHome() {
  return <main id="main-content" className="eaMobileApp">
    <div className="eaMobileInner">
      <header className="eaMobileHeader">
        <Link href="/app" className="eaMobileLogo" aria-label="E&A Auctions начална страница">
          <img src="/brand/ea-2026-app.svg" width={50} height={50} alt="E&A" />
          <span><strong>E&A AUCTIONS</strong><small>EAST WEST AUCTIONEERS GROUP</small></span>
        </Link>
        <Link href="/app/install" className="eaMobileInstallTop" aria-label="Инсталирай E&A Auctions">↓ <span>Инсталирай</span></Link>
      </header>

      <section className="eaMobileHero" aria-labelledby="eaMobileHeading">
        <div className="eaMobileHeroText">
          <span className="eaMobileEyebrow">E&A · ТВОЯТ АВТОМОБИЛЕН ПАЗАР</span>
          <h1 id="eaMobileHeading">Добре дошъл в <em>аукционите.</em></h1>
          <p>Автомобили, търгове и бизнес възможности — удобно от телефона ти.</p>
          <div className="eaMobileHeroActions">
            <Link href="/inventory">Разгледай автомобили <span aria-hidden="true">↗</span></Link>
            <Link href="/register">Регистрация</Link>
          </div>
        </div>
        <div className="eaMobileHeroMark"><img src="/brand/ea-2026-app.svg" width={154} height={154} alt="Лого E&A Auctions" /></div>
      </section>

      <div className="eaMobileDemoNotice"><span aria-hidden="true">ⓘ</span><p><strong>Пилотна версия:</strong> текущото LIVE наддаване е демо. Реални оферти, покупки и плащания ще се активират след проверки.</p></div>

      <section className="eaMobileWelcome" aria-labelledby="eaMobileActionHeading">
        <div className="eaMobileSectionHead"><div><small>НАЧАЛО</small><h2 id="eaMobileActionHeading">Какво искаш да направиш?</h2></div></div>
        <div className="eaMobileQuickGrid">
          {tools.map((item)=><Link href={item.href} key={item.href} className="eaMobileQuickCard">
            <span className="eaMobileQuickIcon" aria-hidden="true">{item.icon}</span>
            <span className="eaMobileQuickCopy"><small>{item.tag}</small><strong>{item.title}</strong><span>{item.subtitle}</span></span>
            <span className="eaMobileArrow" aria-hidden="true">↗</span>
          </Link>)}
        </div>
      </section>

      <section className="eaMobilePromo" aria-labelledby="eaMobilePromoHeading">
        <div className="eaMobilePromoBadge">МОБИЛНО ПРИЛОЖЕНИЕ</div>
        <h2 id="eaMobilePromoHeading">Твоят E&A. Винаги под ръка.</h2>
        <p>Постави E&A Auctions на началния екран. Новите версии идват през сайта — без да сваляш нов инсталатор при всяка промяна.</p>
        <Link href="/app/install">Инсталирай приложението <span aria-hidden="true">↓</span></Link>
      </section>

      <section className="eaMobileSteps" aria-labelledby="eaMobileStepsHeading">
        <div className="eaMobileSectionHead"><div><small>ЗАПОЧНИ ТУК</small><h2 id="eaMobileStepsHeading">Три лесни стъпки</h2></div></div>
        <ol>
          <li><b>01</b><div><strong>Създай профил</strong><p>Регистрирай се и следи статуса на достъпа си.</p></div></li>
          <li><b>02</b><div><strong>Разгледай автомобилите</strong><p>Търси по марка, модел или номер на автомобил.</p></div></li>
          <li><b>03</b><div><strong>Следи аукционите</strong><p>Запознай се с демото; реалното участие изисква одобрен акаунт.</p></div></li>
        </ol>
      </section>
      <footer className="eaMobileFooter">E&A East West Auctioneers Group · Powered by SoulFlame</footer>
    </div>
  </main>;
}
