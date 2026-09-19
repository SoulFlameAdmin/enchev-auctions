import { getHomeHeroCopy, HOME_DISCOVERY_KEYS } from "../home-hero-messages";

const DISCOVERY_MAKES = ["BMW","Mercedes","Audi","Porsche"] as const;

export default function HomeDiscoveryV2(){
  const copy=getHomeHeroCopy("bg-BG");

  return <section
    className="eaHomeDiscoveryV2"
    data-design-task="DP2-06"
    data-locale="bg-BG"
    aria-labelledby="ea-home-discovery-title"
  >
    <div className="eaHomeDiscoveryHead">
      <div>
        <span className="eaHomeDiscoveryKicker" data-i18n-key={HOME_DISCOVERY_KEYS.eyebrow}>{copy.discoveryEyebrow}</span>
        <h2 id="ea-home-discovery-title" data-i18n-key={HOME_DISCOVERY_KEYS.title}>{copy.discoveryTitle}</h2>
        <p data-i18n-key={HOME_DISCOVERY_KEYS.lead}>{copy.discoveryLead}</p>
      </div>
      <a className="eaHomeDiscoveryAdvanced" href="/inventory" data-i18n-key={HOME_DISCOVERY_KEYS.advanced}>{copy.discoveryAdvanced}</a>
    </div>

    <form className="eaHomeDiscoverySearch" action="/inventory" role="search">
      <label htmlFor="ea-home-discovery-query" data-i18n-key={HOME_DISCOVERY_KEYS.searchLabel}>{copy.discoverySearchLabel}</label>
      <div className="eaHomeDiscoverySearchRow">
        <input
          id="ea-home-discovery-query"
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-describedby="ea-home-discovery-hint"
          aria-label={copy.searchAria}
          placeholder={copy.searchPlaceholder}
          data-i18n-key={HOME_DISCOVERY_KEYS.searchPlaceholder}
        />
        <button type="submit" data-i18n-key={HOME_DISCOVERY_KEYS.searchSubmit}>{copy.searchSubmit}</button>
      </div>
      <small id="ea-home-discovery-hint" data-i18n-key={HOME_DISCOVERY_KEYS.searchHint}>{copy.discoverySearchHint}</small>
    </form>

    <div className="eaHomeDiscoveryGroups">
      <div className="eaHomeDiscoveryGroup" data-discovery-group="auction-state">
        <span data-i18n-key={HOME_DISCOVERY_KEYS.stateLabel}>{copy.discoveryStateLabel}</span>
        <nav aria-label={copy.discoveryStateLabel}>
          <a href="/inventory" data-i18n-key={HOME_DISCOVERY_KEYS.all}>{copy.discoveryAll}</a>
          <a href="/inventory?live=1" data-discovery-param="live=1" data-i18n-key={HOME_DISCOVERY_KEYS.live}>{copy.shortcutLive}</a>
          <a href="/inventory?buyNow=1" data-discovery-param="buyNow=1" data-i18n-key={HOME_DISCOVERY_KEYS.buyNow}>{copy.shortcutBuyNow}</a>
        </nav>
      </div>

      <div className="eaHomeDiscoveryGroup" data-discovery-group="make">
        <span data-i18n-key={HOME_DISCOVERY_KEYS.makeLabel}>{copy.discoveryMakeLabel}</span>
        <nav aria-label={copy.discoveryMakeLabel}>
          {DISCOVERY_MAKES.map(make=><a key={make} href={`/inventory?make=${encodeURIComponent(make)}`} data-discovery-param="make">{make}</a>)}
        </nav>
      </div>
    </div>
  </section>;
}
