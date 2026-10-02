import HomeLiveSpotlight from "./HomeLiveSpotlight";
import HomeDiscoveryV2 from "./HomeDiscoveryV2";
import { getHomeHeroCopy, HOME_HERO_KEYS } from "../home-hero-messages";

function T({k,children}:{k:string;children:React.ReactNode}){
  return <span data-i18n-key={k}>{children}</span>;
}

export default function HomeHeroV2(){
  const copy=getHomeHeroCopy("bg-BG");

  return <section className="eaHero eaHeroV2" id="top" data-design-task="DP2-05" data-locale="bg-BG">
    <div className="eaHeroV2Inner">
      <div className="eaHeroV2Content">
        <div className="eaHeroV2Eyebrow"><i aria-hidden="true"/><T k={HOME_HERO_KEYS.eyebrow}>{copy.eyebrow}</T></div>

        <h1 className="eaHeroV2Title">
          <T k={HOME_HERO_KEYS.titlePrimary}>{copy.titlePrimary}</T>
          <T k={HOME_HERO_KEYS.titleSecondary}>{copy.titleSecondary}</T>
          <em><T k={HOME_HERO_KEYS.titleAccent}>{copy.titleAccent}</T></em>
        </h1>

        <p className="eaHeroV2Lead" data-i18n-key={HOME_HERO_KEYS.lead}>{copy.lead}</p>

        <div className="eaHeroV2Actions" aria-label={copy.actionsLabel} data-i18n-key={HOME_HERO_KEYS.actionsLabel}>
          <a className="eaHeroV2Primary" href="/inventory" data-i18n-key={HOME_HERO_KEYS.browse}>{copy.browse}</a>
          <a className="eaHeroV2Secondary" href="/live-auctions" data-i18n-key={HOME_HERO_KEYS.live}><i aria-hidden="true"/>{copy.live}</a>
        </div>

        <div className="eaHeroV2Proof" aria-label={copy.proofLabel} data-i18n-key={HOME_HERO_KEYS.proofLabel}>
          <article>
            <span>01</span>
            <div><b data-i18n-key={HOME_HERO_KEYS.proofStatus}>{copy.proofStatus}</b><small data-i18n-key={HOME_HERO_KEYS.proofStatusDetail}>{copy.proofStatusDetail}</small></div>
          </article>
          <article>
            <span>02</span>
            <div><b data-i18n-key={HOME_HERO_KEYS.proofIdentity}>{copy.proofIdentity}</b><small data-i18n-key={HOME_HERO_KEYS.proofIdentityDetail}>{copy.proofIdentityDetail}</small></div>
          </article>
          <article>
            <span>03</span>
            <div><b data-i18n-key={HOME_HERO_KEYS.proofTransport}>{copy.proofTransport}</b><small data-i18n-key={HOME_HERO_KEYS.proofTransportDetail}>{copy.proofTransportDetail}</small></div>
          </article>
        </div>

        <p className="eaHeroV2Availability" data-i18n-key={HOME_HERO_KEYS.availability}>{copy.availability}</p>
      </div>

      <div className="eaHeroV2Spotlight">
        <HomeLiveSpotlight />
      </div>
    </div>

    <HomeDiscoveryV2 />

    <div className="eaHeroV2Foot">
      <strong data-i18n-key={HOME_HERO_KEYS.footPrimary}>{copy.footPrimary}</strong>
      <span data-i18n-key={HOME_HERO_KEYS.footSecondary}>{copy.footSecondary}</span>
    </div>
  </section>;
}
