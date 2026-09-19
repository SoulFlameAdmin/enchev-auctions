export const HOME_HERO_LOCALES = ["bg-BG","en-US"] as const;
export type HomeHeroLocale = typeof HOME_HERO_LOCALES[number];

export const HOME_HERO_KEYS = {
  eyebrow:"home.hero.eyebrow",
  titlePrimary:"home.hero.title.primary",
  titleSecondary:"home.hero.title.secondary",
  titleAccent:"home.hero.title.accent",
  lead:"home.hero.lead",
  browse:"home.hero.actions.browse",
  live:"home.hero.actions.live",
  proofStatus:"home.hero.proof.status",
  proofStatusDetail:"home.hero.proof.statusDetail",
  proofIdentity:"home.hero.proof.identity",
  proofIdentityDetail:"home.hero.proof.identityDetail",
  proofTransport:"home.hero.proof.transport",
  proofTransportDetail:"home.hero.proof.transportDetail",
  availability:"home.hero.availability.note",
  searchAria:"home.hero.search.aria",
  searchPlaceholder:"home.hero.search.placeholder",
  searchSubmit:"home.hero.search.submit",
  shortcutLabel:"home.hero.shortcut.label",
  footPrimary:"home.hero.foot.primary",
  footSecondary:"home.hero.foot.secondary",
} as const;

const catalog = {
  "bg-BG":{
    eyebrow:"МЕЖДУНАРОДНА ПЛАТФОРМА ЗА АВТОМОБИЛНИ ТЪРГОВЕ",
    titlePrimary:"Намери автомобила.",
    titleSecondary:"Следи търга.",
    titleAccent:"Продължи уверено.",
    lead:"Един ясен buyer flow от откриването на лота и LIVE статуса до историята и организацията на транспорта.",
    browse:"Разгледай автомобилите",
    live:"Отвори LIVE търговете",
    proofStatus:"Ясен auction state",
    proofStatusDetail:"LIVE, предстоящ и приключил лот",
    proofIdentity:"VIN / LOT контекст",
    proofIdentityDetail:"Идентификатори и данни на автомобила",
    proofTransport:"Cross-border flow",
    proofTransportDetail:"Следваща стъпка към транспорта",
    availability:"Наличността, действията и условията се определят от активирания market profile.",
    searchAria:"Търси по марка, модел, VIN или LOT номер",
    searchPlaceholder:"Марка, модел, VIN или LOT номер...",
    searchSubmit:"Търси автомобили",
    shortcutLabel:"Бързи входове към инвентара",
    footPrimary:"От лота до следващата стъпка",
    footSecondary:"ENCHEV · international vehicle auction experience",
  },
  "en-US":{
    eyebrow:"INTERNATIONAL VEHICLE AUCTION PLATFORM",
    titlePrimary:"Find the vehicle.",
    titleSecondary:"Follow the auction.",
    titleAccent:"Move forward with clarity.",
    lead:"One clear buyer flow from lot discovery and LIVE status to vehicle history and transport coordination.",
    browse:"Browse vehicles",
    live:"Open LIVE auctions",
    proofStatus:"Clear auction state",
    proofStatusDetail:"LIVE, upcoming and completed lots",
    proofIdentity:"VIN / LOT context",
    proofIdentityDetail:"Vehicle identifiers and core data",
    proofTransport:"Cross-border flow",
    proofTransportDetail:"A clear next step toward transport",
    availability:"Availability, actions and conditions are determined by the activated market profile.",
    searchAria:"Search by make, model, VIN or LOT number",
    searchPlaceholder:"Make, model, VIN or LOT number...",
    searchSubmit:"Search vehicles",
    shortcutLabel:"Quick inventory entry points",
    footPrimary:"From the lot to the next step",
    footSecondary:"ENCHEV · international vehicle auction experience",
  }
} as const;

export function getHomeHeroCopy(locale:HomeHeroLocale="bg-BG"){
  return catalog[locale];
}
