import type {PlanSection,Service} from "./data";

export type MarketLevel="bg"|"eu";
export type Milestone="bg"|"eu"|"future";
export type CategoryDetail={tracks:{name:string;tasks:string[];proof:string}[];gate:string;income:string;risks:string[];phases:number[]};
export type PlanCost={startupOther:number;monthlyOther:number;initMitko:number;initBorko:number;monthlyMitko:number;monthlyBorko:number;laborByRoster:boolean;stage:Milestone};

export const detailed:Record<string,CategoryDetail>={
"01":{tracks:[
{name:"Продукт и ядро",tasks:["Профили BUYER/SELLER/ADMIN с разграничени права","Проверим каталог VIN, снимки, документи, лотове","Проверени аукционни правила и версия на условията"],proof:"Приет E2E сценарий и QA отчет"},
{name:"Live auctions",tasks:["Сървърен таймер, prebid, max bid и late-extension","Idempotent заявки и защита от двойно приемане","Reconnect, WebSockets и единствен авторитетен победител"],proof:"Многоклиентски тест с репродуцируеми логове"},
{name:"Плащания и release",tasks:["Лицензиран PSP и документирана договорна роля","Ledger, refund, seller payout и reconciliation","Освобождаване след реално потвърждение на плащането"],proof:"Серия zero-discrepancy sandbox плащания"}],gate:"Real-money GO само след D003, сигурност, PSP, правни договори и успешен E2E пилот.",income:"Комисиони и договорени технологични услуги.",risks:["Корупция на победителя","Непотвърдени production зависимости"],phases:[63,64,65,83,94]},
"02":{tracks:[
{name:"Бранд и Google",tasks:["Google Business Profile, само при допустим реален бизнес","Google Workspace акаунти за нашите хора","GA4, Search Console, Consent Mode, UTM и CRM атрибуция","SEO страници България и Испания"],proof:"Проверена аналитика и измерима B2B форма"},
{name:"Рекламен микс",tasks:["Facebook и Instagram — Meta Ads в един рекламен акаунт","Google Search Ads — заявки с реално намерение","YouTube / Shorts видео кампании, не AdSense","TikTok видео тестове при приложими минимални бюджети"],proof:"Рекламни разходи, показвания, кликове и квалифицирани лийдове"},
{name:"Производство на съдържание",tasks:["Седмичен план за Reels и Shorts","Снимки/видео на реални автомобили и партньори","Скрипт, заснемане, монтаж, субтитри BG/ES","A/B тестове на оферта, страница и креатив"],proof:"Файлове, одобрения и резултати от кампаниите"},
{name:"Екип и развитие",tasks:["Performance Marketer, Sales, Media и CRM по собствена йерархия","Бюджет на кампания + възнаграждение + софтуер","CPL → Qualified Lead → Verified Dealer → Paid Sale"],proof:"CRM funnel и реален CAC"}],gate:"Никакви рекламни прогнози като гаранция; следим реални клиенти и сделки.",income:"Непреки приходи от нови продавачи, купувачи, абонаменти и сделки.",risks:["Импресиите не са уникални хора","Ниски конверсии при слабо предлагане на автомобили"],phases:[75,76,85,90,91]},
"03":{tracks:[
{name:"AI агенти",tasks:["Support agent с knowledge base и предаване към човек","Документен помощник с проверка от оператор","Лог на решения и лимити на инструменти"],proof:"Оценка на реално решени клиентски случаи"},
{name:"AI оценки",tasks:["Data provenance и законни datasets","Backtesting с отделни данни","Human override и model drift мониторинг"],proof:"Документирана грешка, precision/recall и unit cost"}],gate:"AI не управлява победител, банкa, плащане или окончателно KYC решение.",income:"По-ниски разходи и възможни платени проверени услуги.",risks:["Грешни AI твърдения","Недопустими източници на данни"],phases:[88,90,93]},
"04":{tracks:[
{name:"Реални медии",tasks:["Фотографски стандарт за действителния VIN","Снимки на видими дефекти и документи","360° заснемане, файл и mobile performance"],proof:"Качество и проследимост до конкретен автомобил"},
{name:"3D/AR",tasks:["Пилот с действителен автомобил, не чужд GLB demo","3D реконструкция/обработка и fallback","Проверка на лицензите и потребителските устройства"],proof:"Платен/измерен пилот с реални клиенти"}],gate:"Визуализацията не се представя за независима техническа експертиза.",income:"Premium media / inspection пакети без двойно отчитане.",risks:["Големи файлове","Несъответствие на модела с действителната кола"],phases:[81,82]},
"05":{tracks:[
{name:"Cloud & Database",tasks:["Изолиране на production/staging, секрети и migrations","PostgreSQL индекси, backups, RLS и restore","Vercel, Supabase, Redis, domain и CDN"],proof:"D003 PASS и restore тест"},
{name:"Worker and Scaling",tasks:["Durable queue/worker, retry, dead-letter","Monitoring/observability и SLO","Load, chaos и failover тестове"],proof:"Измерени системни граници"}],gate:"Няма закупуване на собствени GPU сървъри само по предположения.",income:"Технологична услуга с договорена цена, отделна от реалния облачен разход.",risks:["Независим production worker липсва","Неизяснени cloud лимити"],phases:[94,95]},
"06":{tracks:[
{name:"Ръководство",tasks:["Енчев → Митко и Борко → всички наши екипи","Матрица на права, подписи и одобрения","Management reporting, board decisions"],proof:"Подписан governance и management договор"},
{name:"Корпоративен контрол",tasks:["Планиране на бюджети и доставчици","Единни cost centers и без двойно начисляване","KPI, risk register, weekly report"],proof:"Единен P&L и управленски отчет"}],gate:"Неформалните роли не заменят договорно предоставените правомощия.",income:"Договорено възнаграждение за управление/технологии, не автоматично такса към всички отдели.",risks:["Дублиране на управленски труд","Неясна собственост върху IP"],phases:[62,79,89,99]},
"07":{tracks:[
{name:"Продавачи",tasks:["Списък с проверени автокъщи","Intro → meeting → KYB → първи автомобил","Anchor Sellers с реални лотове"],proof:"Активни продавачи и допустими обяви"},
{name:"Купувачи",tasks:["Купувачи по категории и държави","Първа покупка и повторяемост","CRM lead ownership и conversion tracking"],proof:"Завършени реални продажби"},
{name:"Call Center",tasks:["Наши BG и ES оператори","Квалифицирани разговори и запис на срещи","Скриптове, consent и забранени маркетингови контакти"],proof:"Качествени CRM записи, не гол брой набрани номера"},
{name:"Twilio",tasks:["Programmable Voice и браузърен dialer за оператори","Международни маршрути и Geo Permissions low-risk only","Разход по дестинация и минутите","Забрана за автоматично звънене на непроверени списъци"],proof:"Разрешени тестови разговори и измерени сметки"}],gate:"Не осъществяваме чуждестранни търговски обаждания без локален правен преглед.",income:"Нови фирмени клиенти и сделки; такса за звон не е приход.",risks:["GDPR и местни правила за cold calling","Twilio toll fraud"],phases:[75,76,77,91]},
"08":{tracks:[
{name:"Етап 1 — Чужд транспорт",tasks:["Договори с лицензирани превозвачи","Реални оферти BG/ES/ЕС","Проследяване, документи и застраховки"],proof:"Завършени превози с проверена себестойност"},
{name:"Етап 2 — Наш логистичен отдел",tasks:["Наши Logistics Manager и диспечери","Транспортен софтуер, статуси, CRM","Марж и партньорски KPI по маршрут"],proof:"Стабилно натоварване и положителен принос"},
{name:"Етап 3 — Собствени автовози",tasks:["3–6 месеца измерен товарен поток","Пълен CAPEX/OPEX и сравнение с външните тарифи","Квалификации, шофьори, лицензиране, застраховки","Финансов резерв и инвестиционен GO"],proof:"Подписано инвестиционно решение; НЕ в началните разходи"}],gate:"Никакви собствени камиони в първоначалния план.",income:"Договорно допустима координационна такса/марж; собствен превоз по-късно.",risks:["Застрахователни щети","Висок капитал в неработещ автопарк"],phases:[73,74,80,87]},
"09":{tracks:[
{name:"B2B и корпоративна правна рамка",tasks:["Marketplace vs principal договорна роля","Buyer/Seller terms и комисиони","IP, договорни права и правомощия"],proof:"Подписани правила и правно становище"},
{name:"Клиенти и данни",tasks:["KYC/KYB, AML при приложимост","GDPR, DSA при приложимост, B2C future scope","Договори с PSP, транспортни фирми и обработващи данни"],proof:"Юридически country gate"},
{name:"Автомобили и международни сделки",tasks:["Title, transfer, registration documents","VAT, REBU, DAC7, customs по сделката","Регулаторен calendar BG/ES"],proof:"Приложим правен и данъчен профил"}],gate:"Не активираме държава само с преведен интерфейс.",income:"Не е самостоятелен приход; предотвратява санкции и загуби.",risks:["Неправилен ДДС режим","Проблем с представителната власт"],phases:[62,63,67,69,70,71,72,97]},
"10":{tracks:[
{name:"Приход и GMV",tasks:["Признат приход vs GMV","Agent/principal анализ от счетоводител","Fee versioning и invoice logic"],proof:"Единна счетоводна политика"},
{name:"Плащания",tasks:["Лицензиран PSP и settlement","Deposits/refunds/seller payouts под контрол","Double-entry ledger и reconciliation"],proof:"10/10 без разлика в sandbox settlement"},
{name:"Финансов модел",tasks:["2027–2029 три сценария","Cash flow, runway и оборотен капитал","CAPEX/OPEX и бюджетна централизация"],proof:"CFO/счетоводен review"}],gate:"Депозитът на купувач не се записва автоматично като приход.",income:"Комисиони, абонаменти и реално предоставени услуги.",risks:["Двойно признат приход","Недостиг на ликвидност"],phases:[64,65,66,67,68,87,89]},
"11":{tracks:[
{name:"Product Security",tasks:["MFA, IAM, RLS, tenant isolation","API auth, webhook signature, secrets","OWASP, bot abuse, WAF и DDoS"],proof:"Security gates и negative tests"},
{name:"Operational Security",tasks:["SOC и incident response","Backup/restore и disaster recovery","Independent penetration test + retest"],proof:"Critical/High resolution и owner GO"}],gate:"Няма real-money GO с нерешени критични уязвимости.",income:"Непряк принос: защита на стойността и репутацията.",risks:["Неоторизирани оферти","Източване на токени или лични данни"],phases:[69,88,94,95,96]},
"12":{tracks:[
{name:"Автоматизирани операции",tasks:["Outbox → queue → durable worker","n8n за некритични бизнес процеси","Idempotency, human approvals, observability"],proof:"Workflow тестове и trace"},
{name:"CRM/Finance/Logistics",tasks:["Follow-ups и разрешени уведомления","Документна обработка и жалби","Плащания само с утвърден authorization gate"],proof:"E2E операция с човешки надзор"}],gate:"n8n не може да задава победител или да променя ledger произволно.",income:"По-нисък оперативен разход, не гарантиран нов приход.",risks:["Непроверен agent action","Дублирани външни операции"],phases:[90,93,94]},
"13":{tracks:[
{name:"България",tasks:["Първи истински продавачи и купувачи","Българска правна/финансова схема","Завършен E2E пилот"],proof:"Реални сделки и unit economics"},
{name:"Испания",tasks:["Местни търговски партньори","Език, ДДС, документи, support и carrier quotes","Country Launch Gate без пропуснати проверки"],proof:"Legal/Finance/Tech/Operations GO"},
{name:"Следващи пазари",tasks:["Румъния/Португалия при реални партньори","Германия/Полша при доказан автомобилен поток","Нови офиси/юридически лица само при необходимост"],proof:"Country P&L и решение за разход"}],gate:"Преди продажби в нова държава се доказва приложимият законен модел.",income:"Международни такси и услуги според реалното търсене.",risks:["Мащабиране на загуба","Непроверени местни правила"],phases:[70,71,84,85,86,87,98,99]},
"14":{tracks:[
{name:"CRM",tasks:["Една компания, няколко контакта","Account ownership, lead stages, activity history","Duplicate prevention и permission scoping"],proof:"Проследим corporate onboarding"},
{name:"Support и Disputes",tasks:["Tickets, SLA, escalation","Refund/dispute процедура с evidence freeze","Human/AI handoff и multilingual BG/ES"],proof:"Измерени първи отговори и реално решени случаи"}],gate:"24/7 обслужване се обещава само при действителни смени.",income:"Повече retention и повторни сделки, без двоен приход.",risks:["Неправомерно разкриване на данни","Преждевременно затворени тикети"],phases:[75,76,77,78]},
"15":{tracks:[
{name:"Inspection & Media",tasks:["VIN-specific снимки и damage map","360° обзор на действителен автомобил","QA и проверим произход"],proof:"Реален инспекционен пакет"},
{name:"AI и EV",tasks:["CV benchmark с независими тестови данни","Пазарна оценка с валидни comparable sales","Battery SOH и DPP connectors само от разрешени източници"],proof:"TRL review и business value gate"}],gate:"Демо GLB, AI прогноза или VIN mock не са независима автомобилна инспекция.",income:"Платени медийни/инспекционни услуги, в рамките на общите други приходи.",risks:["Права върху 3D данни","Невалидиран модел"],phases:[81,82,90]},
"16":{tracks:[
{name:"Управление на персонала",tasks:["Подписана управленска йерархия","Заплати, осигуровки и договори BG/ES","Назначения по доказано натоварване"],proof:"Организационен и payroll review"},
{name:"Обучения и защита",tasks:["Вътрешна академия Sales/Support/Engineering","MFA, IAM и offboarding","Управление на смени, отпуски и безопасност"],proof:"Практически тестове, сертифициране и audit trail"}],gate:"Бюджетът на хората се отчита един път в общия персонал.",income:"Непряка стойност: продуктивност, безопасност и капацитет.",risks:["Двойно заплатен труд","Невалидна международна заетост"],phases:[62,92,94]}
};

export const staffByLevel={
bg:[
{id:"tech",name:"Програмист / Backend",count:1,monthly:2700,dept:"Engineering"},
{id:"qa",name:"QA / DevOps капацитет",count:.5,monthly:3000,dept:"Engineering"},
{id:"ops",name:"Auction / Operations",count:.5,monthly:1900,dept:"Operations"},
{id:"legal",name:"Правни и счетоводни консултации",count:0,monthly:1700,dept:"External only"}
],
eu:[
{id:"tech",name:"Програмисти",count:3,monthly:3300,dept:"Engineering"},
{id:"qa",name:"QA / DevOps",count:1.5,monthly:3500,dept:"Engineering"},
{id:"ops",name:"Auction / Operations",count:2,monthly:2300,dept:"Operations"},
{id:"country",name:"Country Coordinator ES",count:1,monthly:3700,dept:"International"},
{id:"logistics",name:"Логистичен координатор",count:1,monthly:2300,dept:"Logistics"},
{id:"finance",name:"Finance / Compliance Ops",count:1,monthly:3100,dept:"Finance"}
]} as const;
export type StaffItem={id:string;name:string;count:number;monthly:number;dept:string};

const futurePattern=/собствен автовоз|собствен.*автовоз|собствен.*камион|own fleet/i;
const esPattern=/испани|spanish|\bES\b|international|EU Expansion|Market Entry|country/i;
const staffPattern=/оператор|Sales Manager|BG Support|ES Support|бизнес управление|управление|HR Setup|Payroll Coordination/i;
export function lineCost(s:PlanSection,service:Service,i:number):PlanCost {
 const future=!!(service.phase?.includes("НЕ Е ВКЛЮЧЕНО")||futurePattern.test(service.name));
 const stage:Milestone=future?"future":(esPattern.test(service.name)?"eu":"bg");
 const laborByRoster=staffPattern.test(service.name)&&["06","07","14","16"].includes(s.id);
 const start=service.setup[0]||0;
 const perMonth=service.monthly[0]||0;
 const startupOther=future?0:Math.round(start*0.78);
 const monthlyOther=future||laborByRoster||s.id==="02"?0:Math.round(perMonth*0.70);
 const initMitko=future?0:Math.min(16,Math.max(1,Math.round(start/1200)));
 const initBorko=future?0:Math.min(30,Math.max(2,Math.round(start/800)));
 const monthlyMitko=future?0:((s.id==="06"||s.id==="07"||s.id==="13")?3:1);
 const monthlyBorko=future?0:((s.id==="01"||s.id==="03"||s.id==="05"||s.id==="11"||s.id==="12")?3:1);
 return {startupOther,monthlyOther,initMitko,initBorko,monthlyMitko,monthlyBorko,laborByRoster,stage};
}
export function enabledByLevel(cost:PlanCost,level:MarketLevel){return cost.stage!=="future"&&(cost.stage==="bg"||level==="eu");}
export const masterSources=[
{label:"MASTER SYSTEM v1 FROZEN",href:"https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/docs/MASTER_SYSTEM_PLAN_V1_FROZEN.md",desc:"1054 начални системни задачи — източник на истината"},
{label:"MASTER SYSTEM EXPANSION v2",href:"https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/docs/MASTER_SYSTEM_EXPANSION_V2.md",desc:"3226 задачи, фазите 62–99 и зависимости"},
{label:"Спешен 119-дневен план",href:"https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/docs/urgent-auction-architecture-119.md",desc:"119 дни, тестове, конкретни критерии за приемане"},
{label:"D003 blocker",href:"https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/docs/urgent-D003-db-binding-audit-2026-11-03.md",desc:"Незавършена проверка на авторитетната база"}
];
