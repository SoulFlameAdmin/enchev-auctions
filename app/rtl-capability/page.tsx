import { layoutDirectionAttributes } from "../../packages/config/src/rtl-layout-capability";
import styles from "./rtl-capability.module.css";

function requireDirection(direction: "ltr" | "rtl") {
  const attributes = layoutDirectionAttributes({ locale: "und", direction });
  if (!attributes) {
    throw new Error("RTL capability fixture failed to resolve");
  }
  return attributes;
}

const ltr = requireDirection("ltr");
const rtl = requireDirection("rtl");

function Probe({ direction, lang }: { direction: "ltr" | "rtl"; lang: string }) {
  return (
    <section className={styles.probe} dir={direction} lang={lang} data-rtl-probe={direction}>
      <div className={styles.inlineMarker} data-inline-marker />
      <div className={styles.copy}>
        <span className={styles.kicker}>ПОСОКА · {direction.toUpperCase()}</span>
        <strong>Тест на международния изглед на ENCHEV</strong>
        <p>Една и съща структура запазва логическите отстояния, рамки, подравняване и позициониране на действията.</p>
      </div>
      <div className={styles.rail} data-rtl-rail>
        <span data-rail-item="lead">01</span>
        <span data-rail-item="middle">02</span>
        <span data-rail-item="tail">03</span>
      </div>
      <div className={styles.actions}>
        <button type="button">Вторично</button>
        <button type="button">Основно</button>
      </div>
    </section>
  );
}

export default function RtlCapabilityPage() {
  return (
    <main className={styles.page} data-rtl-capability-page>
      <header className={styles.header}>
        <span>21.17</span>
        <h1>Поддръжка на оформление отдясно наляво</h1>
        <p>Изолиран тестов екран. Това не е активиран производствен език или пазар.</p>
      </header>
      <div className={styles.grid}>
        <Probe direction={ltr.dir} lang={ltr.lang} />
        <Probe direction={rtl.dir} lang={rtl.lang} />
      </div>
    </main>
  );
}
