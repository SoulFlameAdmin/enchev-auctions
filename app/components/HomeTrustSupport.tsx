import styles from "./HomeTrustSupport.module.css";

export default function HomeTrustSupport(){
  return (
    <section className={styles.section} aria-labelledby="trust-support-heading" data-design-task="D10" data-section="trust-support-coverage">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <span>ДОВЕРИЕ · ПОДКРЕПА · ОБХВАТ</span>
          <h2 id="trust-support-heading">Ясна информация на всеки етап</h2>
          <p>ENCHEV подрежда ключовия контекст за лота, помощта за купувача и международните маршрути в отделни, лесни за намиране входни точки.</p>
        </header>

        <div className={styles.grid}>
          <article className={styles.card} aria-labelledby="trust-card-heading">
            <span className={styles.badge}>ДОВЕРИЕ</span>
            <h3 id="trust-card-heading">Последователен контекст за лота</h3>
            <p>Лот, VIN, локация, повреда и статус на търга следват една и съща информационна йерархия, за да можеш да сравняваш автомобилите по-лесно.</p>
            <a className={styles.link} href="/inventory">Разгледай инвентара →</a>
          </article>

          <article className={styles.card} aria-labelledby="support-card-heading">
            <span className={styles.badge}>ПОДДРЪЖКА</span>
            <h3 id="support-card-heading">Помощ за купувача на едно място</h3>
            <p>От търсене и участие на живо до транспорт и профил — отделната зона за поддръжка събира основните пътища за помощ, без да прекъсва пътя на купувача.</p>
            <a className={styles.link} href="/support">Отвори поддръжката →</a>
          </article>

          <aside className={styles.coverage} aria-labelledby="coverage-heading">
            <div className={styles.coverageTop}><span>МЕЖДУНАРОДНО ПОКРИТИЕ</span><strong className={styles.liveDot}>ДОСТЪП ДО ПАЗАРА</strong></div>
            <h3 id="coverage-heading">Европа · САЩ · Канада</h3>
            <p>Пазарният обхват е видим още от началната страница, а транспортният процес дава директен път към следващата логистична стъпка след избора на автомобил.</p>
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
