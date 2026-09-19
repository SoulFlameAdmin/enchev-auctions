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
        <span className={styles.kicker}>DIRECTION · {direction.toUpperCase()}</span>
        <strong>ENCHEV international layout probe</strong>
        <p>The same markup preserves logical spacing, borders, alignment and action placement.</p>
      </div>
      <div className={styles.rail} data-rtl-rail>
        <span data-rail-item="lead">01</span>
        <span data-rail-item="middle">02</span>
        <span data-rail-item="tail">03</span>
      </div>
      <div className={styles.actions}>
        <button type="button">Secondary</button>
        <button type="button">Primary</button>
      </div>
    </section>
  );
}

export default function RtlCapabilityPage() {
  return (
    <main className={styles.page} data-rtl-capability-page>
      <header className={styles.header}>
        <span>21.17</span>
        <h1>RTL layout capability</h1>
        <p>Isolated acceptance surface. This is not a production locale or market activation.</p>
      </header>
      <div className={styles.grid}>
        <Probe direction={ltr.dir} lang={ltr.lang} />
        <Probe direction={rtl.dir} lang={rtl.lang} />
      </div>
    </main>
  );
}
