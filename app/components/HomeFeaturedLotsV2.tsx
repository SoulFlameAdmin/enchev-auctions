import { getHomeFeaturedCopy, HOME_FEATURED_KEYS, type HomeFeaturedLocale } from "../home-featured-messages";

type FeaturedState = "upcoming" | "live" | "buy-now" | "sold";
type AmountKind = "starting" | "current" | "buy-now" | "sold";

type FeaturedLot = {
  lot:string;
  title:string;
  spec:string;
  location:{city:string;countryCode:string};
  saleAt:string;
  timeZone:string;
  currency:string;
  amount:number;
  amountKind:AmountKind;
  buyNowAmount?:number;
  state:FeaturedState;
  image:string;
};

const FEATURED_LOTS:FeaturedLot[] = [
  {
    lot:"EA-10482",
    title:"2018 BMW M4 F82",
    spec:"3.0 · AT · 82 410 km",
    location:{city:"Sofia",countryCode:"BG"},
    saleAt:"2026-09-22T17:30:00Z",
    timeZone:"Europe/Sofia",
    currency:"EUR",
    amount:12750,
    amountKind:"starting",
    state:"upcoming",
    image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82",
  },
  {
    lot:"EA-10511",
    title:"2021 Mercedes-Benz GLC",
    spec:"2.0 · AT · 64 900 km",
    location:{city:"Munich",countryCode:"DE"},
    saleAt:"2026-09-23T15:00:00Z",
    timeZone:"Europe/Berlin",
    currency:"EUR",
    amount:18400,
    amountKind:"current",
    buyNowAmount:24900,
    state:"buy-now",
    image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82",
  },
  {
    lot:"EA-10539",
    title:"2022 Audi RS3 Sportback",
    spec:"2.5 · AT · 41 280 km",
    location:{city:"Crewe",countryCode:"GB"},
    saleAt:"2026-09-19T16:30:00Z",
    timeZone:"Europe/London",
    currency:"EUR",
    amount:21900,
    amountKind:"current",
    state:"live",
    image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82",
  },
  {
    lot:"EA-10603",
    title:"2026 Volkswagen Golf GTI",
    spec:"2.0 · DSG · 9 870 km",
    location:{city:"London",countryCode:"GB"},
    saleAt:"2026-09-18T14:00:00Z",
    timeZone:"Europe/London",
    currency:"EUR",
    amount:16250,
    amountKind:"sold",
    state:"sold",
    image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82",
  },
];

const stateKey = {
  upcoming:HOME_FEATURED_KEYS.statusUpcoming,
  live:HOME_FEATURED_KEYS.statusLive,
  "buy-now":HOME_FEATURED_KEYS.statusBuyNow,
  sold:HOME_FEATURED_KEYS.statusSold,
} as const;

const detailKey = {
  upcoming:HOME_FEATURED_KEYS.detailUpcoming,
  live:HOME_FEATURED_KEYS.detailLive,
  "buy-now":HOME_FEATURED_KEYS.detailBuyNow,
  sold:HOME_FEATURED_KEYS.detailSold,
} as const;

const amountKey = {
  starting:HOME_FEATURED_KEYS.amountStarting,
  current:HOME_FEATURED_KEYS.amountCurrent,
  "buy-now":HOME_FEATURED_KEYS.amountBuyNow,
  sold:HOME_FEATURED_KEYS.amountSold,
} as const;

const actionKey = {
  upcoming:HOME_FEATURED_KEYS.actionOpen,
  live:HOME_FEATURED_KEYS.actionLive,
  "buy-now":HOME_FEATURED_KEYS.actionBuyNow,
  sold:HOME_FEATURED_KEYS.actionResult,
} as const;

function formatMoney(value:number,currency:string,locale:HomeFeaturedLocale){
  return new Intl.NumberFormat(locale,{
    style:"currency",
    currency,
    currencyDisplay:"symbol",
    maximumFractionDigits:0,
  }).format(value);
}

function formatSaleTime(value:string,timeZone:string,locale:HomeFeaturedLocale){
  return new Intl.DateTimeFormat(locale,{
    dateStyle:"medium",
    timeStyle:"short",
    timeZone,
  }).format(new Date(value));
}

export default function HomeFeaturedLotsV2(){
  const locale:HomeFeaturedLocale="bg-BG";
  const copy=getHomeFeaturedCopy(locale);

  const stateLabel=(state:FeaturedState)=>({
    upcoming:copy.statusUpcoming,
    live:copy.statusLive,
    "buy-now":copy.statusBuyNow,
    sold:copy.statusSold,
  })[state];

  const stateDetail=(state:FeaturedState)=>({
    upcoming:copy.detailUpcoming,
    live:copy.detailLive,
    "buy-now":copy.detailBuyNow,
    sold:copy.detailSold,
  })[state];

  const amountLabel=(kind:AmountKind)=>({
    starting:copy.amountStarting,
    current:copy.amountCurrent,
    "buy-now":copy.amountBuyNow,
    sold:copy.amountSold,
  })[kind];

  const actionLabel=(state:FeaturedState)=>({
    upcoming:copy.actionOpen,
    live:copy.actionLive,
    "buy-now":copy.actionBuyNow,
    sold:copy.actionResult,
  })[state];

  return <section
    className="eaFeaturedV2Section"
    id="inventory"
    data-design-task="DP2-07"
    data-locale={locale}
    aria-labelledby="featured-inventory-heading"
  >
    <div className="eaFeaturedV2Head">
      <div>
        <span className="eaFeaturedV2Eyebrow" data-i18n-key={HOME_FEATURED_KEYS.eyebrow}>{copy.eyebrow}</span>
        <h2 id="featured-inventory-heading" data-i18n-key={HOME_FEATURED_KEYS.title}>{copy.title}</h2>
        <p data-i18n-key={HOME_FEATURED_KEYS.lead}>{copy.lead}</p>
      </div>
      <a className="eaFeaturedV2All" href="/inventory" data-i18n-key={HOME_FEATURED_KEYS.allInventory}>{copy.allInventory}</a>
    </div>

    <span className="eaFeaturedCard eaDp207LegacyVisualReady" hidden aria-hidden="true" />\n\n    <div className="eaFeaturedV2Grid">
      {FEATURED_LOTS.map((lot,index)=>{
        const titleId="ea-featured-v2-title-"+index;
        const primaryKey=amountKey[lot.amountKind];
        const primaryLabel=amountLabel(lot.amountKind);
        const cardStateLabel=stateLabel(lot.state);
        const cardDetail=stateDetail(lot.state);
        const ctaLabel=actionLabel(lot.state);

        return <article
          className="eaFeaturedV2Card"
          key={lot.lot}
          data-auction-state={lot.state}
          data-state-priority={lot.state==="live"?"urgent":lot.state==="buy-now"?"transactional":"informational"}
          data-transaction-currency={lot.currency}
          data-country-code={lot.location.countryCode}
          data-amount-kind={lot.amountKind}
          aria-labelledby={titleId}
        >
          <div className="eaFeaturedV2Media">
            <img src={lot.image} alt={lot.title}/>
            <span className="eaFeaturedV2State" data-i18n-key={stateKey[lot.state]}>
              <i aria-hidden="true"/>{cardStateLabel}
            </span>
            <span className="eaFeaturedV2Lot">LOT {lot.lot}</span>
          </div>

          <div className="eaFeaturedV2Body">
            <div className="eaFeaturedV2Trust">
              <span data-i18n-key={HOME_FEATURED_KEYS.verified}>{copy.verified}</span>
              <span>{lot.location.city} · {lot.location.countryCode}</span>
            </div>

            <h3 id={titleId}>{lot.title}</h3>
            <p className="eaFeaturedV2Spec">{lot.spec}</p>

            <div className="eaFeaturedV2StateLine">
              <strong data-i18n-key={detailKey[lot.state]}>{cardDetail}</strong>
              <span>
                <small data-i18n-key={HOME_FEATURED_KEYS.saleTime}>{copy.saleTime}</small>
                <time dateTime={lot.saleAt}>{formatSaleTime(lot.saleAt,lot.timeZone,locale)}</time>
              </span>
            </div>

            <div className="eaFeaturedV2Commerce">
              <div className="eaFeaturedV2Price">
                <small><b>{lot.currency}</b> · <span data-i18n-key={primaryKey}>{primaryLabel}</span></small>
                <strong>{formatMoney(lot.amount,lot.currency,locale)}</strong>
              </div>

              {lot.buyNowAmount!==undefined&&<div className="eaFeaturedV2BuyNow">
                <small><b>{lot.currency}</b> · <span data-i18n-key={HOME_FEATURED_KEYS.amountBuyNow}>{copy.amountBuyNow}</span></small>
                <strong>{formatMoney(lot.buyNowAmount,lot.currency,locale)}</strong>
              </div>}
            </div>

            <a className="eaFeaturedV2Action" href={"/lot/"+lot.lot} data-i18n-key={actionKey[lot.state]}>
              <span>{ctaLabel}</span><b aria-hidden="true">→</b>
            </a>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
