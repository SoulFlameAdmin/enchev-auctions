import styles from "./HomeTrustSupport.module.css";

export default function HomeTrustSupport(){
  return (
    <section className={styles.section} aria-labelledby="trust-support-heading">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <span>ДОВЕРИЕ · ПОДКРЕПА · ОБХВАТ</span>
          <h2 id="trust-support-heading">Ясна информация на всеки етап</h2>
          <p>ENCHEV подрежда ключовия контекст за лота, помощта за купувача и международните маршрути в отделни, лесни за намиране входни точки.</p>
        </header>

        <div className={styles.grid}>
          <article className={styles.card} aria-labelledby="trust-card-heading">
            <span className={styles.badge}>TRUST</span>
            <h3 id="trust-card-heading">Последователен контекст за лота</h3>
            <p>LOT, VIN, локация, повреда и auction status следват една и съща информационна йерархия, за да можеш да сравняваш автомобилите по-лесно.</p>
            <a className={styles.link} href="/inventory">Разгледай инвентара →</a>
          </article>

          <article className={styles.card} aria-labelledby="support-card-heading">
            <span className={styles.badge}>SUPPORT</span>
            <h3 id="support-card-heading">Помощ за купувача на едно място</h3>
            <p>От търсене и LIVE участие до транспорт и профил — отделната support зона събира основните пътища за помощ без да прекъсва buyer journey.</p>
            <a className={styles.link} href="/support">Отвори поддръжката →</a>
          </article>

          <aside className={styles.coverage} aria-labelledby="coverage-heading">
            <div className={styles.coverageTop}><span>INTERNATIONAL COVERAGE</span><strong className={styles.liveDot}>MARKET ACCESS</strong></div>
            <h3 id="coverage-heading">Европа · САЩ · Канада</h3>
            <p>Пазарният обхват е видим още от началната страница, а транспортният flow дава директен път към следващата логистична стъпка след избора на автомобил.</p>
            <ul className={styles.regions} aria-label="Пазарни региони">
              <li><b>Европа</b><span>Европейски лотове и маршрути.</span></li>
              <li><b>САЩ</b><span>Лотове от американски пазари.</span></li>
              <li><b>Канада</b><span>Международен пазарен обхват.</span></li>
            </ul>
            <div className={styles.actions}><a href="/inventory">Разгледай пазара</a><a href="/transport">Виж транспорта →</a></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
