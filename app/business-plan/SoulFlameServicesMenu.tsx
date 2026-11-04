"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sections } from "./data";
import { detailed } from "./master-plan-data";
import "./soulflame-menu.css";

type Props = { onSelect: (id: string) => void };

export default function SoulFlameServicesMenu({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>("02");
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      openButtonRef.current?.focus();
    };
  }, [open]);

  const filtered = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("bg-BG");
    if (!value) return sections;
    return sections.filter((section) => {
      const info = detailed[section.id];
      const haystack = [
        section.title, section.tagline, section.goal,
        ...section.services.flatMap((service) => [service.name, service.detail, service.team]),
        ...(info?.tracks.flatMap((track) => [track.name, ...track.tasks]) ?? [])
      ].join(" ").toLocaleLowerCase("bg-BG");
      return haystack.includes(value);
    });
  }, [search]);

  const selectPlan = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  return <>
    <button
      ref={openButtonRef}
      type="button"
      className="sf-open-menu"
      onClick={() => setOpen(true)}
      aria-expanded={open}
      aria-controls="sf-services-drawer"
      aria-label="Отвори всички услуги и възможности на SoulFlame"
    >
      <span className="sf-open-text">SOULFLAME <small>ВСИЧКИ УСЛУГИ</small></span>
      <span className="sf-burger-lines" aria-hidden="true"><i/><i/><i/></span>
    </button>

    {open && <>
      <button className="sf-menu-backdrop" type="button" onClick={() => setOpen(false)} aria-label="Затвори менюто SoulFlame"/>
      <aside
        ref={drawerRef}
        className="sf-services-drawer"
        id="sf-services-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-services-heading"
      >
        <div className="sf-menu-top">
          <div>
            <span className="sf-brand">SOULFLAME <b>◆</b></span>
            <span className="sf-tag">ТЕХНОЛОГИИ · БИЗНЕС · AI · АВТОМАТИЗАЦИИ</span>
          </div>
          <button ref={closeButtonRef} className="sf-menu-close" type="button" onClick={() => setOpen(false)} aria-label="Затвори менюто">×</button>
        </div>

        <div className="sf-menu-intro">
          <h2 id="sf-services-heading">Какво изгражда и поддържа SoulFlame</h2>
          <p>Отваряш направление → конкретна услуга → дейностите, системите и екипа. От всеки раздел можеш да преминеш към подробния финансов план на ENCHEV.</p>
          <div className="sf-menu-disclaimer">Каталог на предлагани и планирани възможности. Отделните функции се изпълняват според договорения обхват; не всички са вече внедрени в ENCHEV.</div>
        </div>

        <label className="sf-menu-search">
          <span>ТЪРСИ ВЪЗМОЖНОСТ</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Например: Twilio, AI, SEO, CRM, 3D..." autoComplete="off"/>
        </label>

        <div className="sf-menu-list" aria-label="16 направления на SoulFlame">
          {filtered.map((section) => {
            const detail = detailed[section.id];
            const active = expanded === section.id;
            return <section className={"sf-menu-section" + (active ? " sf-active" : "")} key={section.id}>
              <button
                type="button"
                className="sf-menu-section-trigger"
                aria-expanded={active}
                onClick={() => setExpanded(active ? null : section.id)}
              >
                <span className="sf-menu-num">{section.id}</span>
                <span className="sf-menu-section-heading"><strong>{section.title}</strong><small>{section.tagline}</small></span>
                <span className="sf-menu-expand-icon" aria-hidden="true">{active ? "−" : "+"}</span>
              </button>
              {active && <div className="sf-menu-section-content">
                <p className="sf-menu-goal">{section.goal}</p>
                <div className="sf-menu-eyebrow">КОНКРЕТНИ УСЛУГИ · {section.services.length}</div>
                <div className="sf-menu-services">
                  {section.services.map((service, i) => <details className="sf-menu-service" key={i}>
                    <summary><span>{service.name}</span><span className="sf-menu-more" aria-hidden="true">⌄</span></summary>
                    <div className="sf-menu-service-body">
                      <p>{service.detail}</p>
                      <p><strong>Екип:</strong> {service.team}</p>
                      <p><strong>Еднократно:</strong> {service.setup[0]}–{service.setup[1]} € · <strong>Месечно:</strong> {service.monthly[0]}–{service.monthly[1]} €</p>
                      <small>Примерни бюджети, не потвърдени оферти. Крайната сума и трудът са в бизнес плана.</small>
                    </div>
                  </details>)}
                </div>
                <div className="sf-menu-eyebrow">КАКВО ТОЧНО ВКЛЮЧВА</div>
                <div className="sf-menu-workflows">
                  {detail.tracks.map((track, i) => <details key={i}>
                    <summary>{track.name}</summary>
                    <ul>{track.tasks.map((task, j) => <li key={j}>{task}</li>)}</ul>
                    <p><strong>Приемане:</strong> {track.proof}</p>
                  </details>)}
                </div>
                <button type="button" className="sf-menu-plan-link" onClick={() => selectPlan(section.id)}>
                  Отвори пълния раздел и калкулатора <span aria-hidden="true">↗</span>
                </button>
              </div>}
            </section>;
          })}
          {filtered.length === 0 && <p className="sf-menu-no-results">Няма намерено направление. Опитай друга дума.</p>}
        </div>

        <div className="sf-menu-footer">
          <div>SOULFLAME · 16 НАПРАВЛЕНИЯ</div>
          <a href="/">Към ENCHEV AUCTIONS <span aria-hidden="true">↗</span></a>
        </div>
      </aside>
    </>}
  </>;
}
