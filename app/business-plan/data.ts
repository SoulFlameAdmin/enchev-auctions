export type Service = { name: string; detail: string; setup: [number,number]; monthly: [number,number]; team: string; phase?: string };
export type PlanSection = { id: string; title: string; tagline: string; icon: string; goal: string; team: string[]; steps: string[]; services: Service[]; risk: string };
/** Investment worksheet: indicative EUR excluding VAT, not quotes, salaries or live operational status. Cost centers must be consolidated before funding. */
export const sections:PlanSection[] = [
{id:"01",title:"Платформа и технологии",tagline:"Търгове, приложения, API, плащания",icon:"⌘",goal:"Надежден B2B аукционен продукт с проверени права и истински финансови процеси.",team:["Product Lead","Frontend / Backend","QA Engineer","DevOps"],steps:["Затваряне на D003 и изолиране на Production","Авторитетни оферти, победител и документи","PSP sandbox, тестове и разрешен пилот"],risk:"READY сайт ≠ разрешени реални плащания.",
services:[
{name:"Аукционна B2B основа",detail:"Регистрация, автомобилни обяви, правила и backoffice.",setup:[10000,30000],monthly:[300,1200],team:"Engineering",phase:"MVP"},
{name:"Realtime търгове",detail:"Сървърен таймер, idempotency, reconnect, worker.",setup:[8000,24000],monthly:[150,700],team:"Backend + QA"},
{name:"Плащания и документи",detail:"PSP, ledger, reconciliation, фактури; правно одобрение.",setup:[8000,26000],monthly:[200,900],team:"Backend + Finance"},
{name:"PWA приложение",detail:"Мобилни екрани и ъпдейти без ново инсталиране.",setup:[3500,14000],monthly:[50,300],team:"Frontend"}
]},
{id:"02",title:"Маркетинг и реклама",tagline:"Google, Meta, TikTok, YouTube, видео и SEO",icon:"↗",goal:"Редовно да намираме реални продавачи и купувачи; измерваме активирани фирми и завършени сделки.",team:["Growth Lead","B2B Sales","Media Editor","Performance Marketer","CRM"],steps:["Google Business Profile само при допустим реален бизнес","Workspace, CRM, Analytics, Pixel/Consent Mode","Реални видеа, FB/IG/YouTube/Search тестове","Седмична оптимизация по цена на проверен дилър"],risk:"Показванията не са уникални хора; рекламите не гарантират сделки.",
services:[
{name:"Google Business Profile",detail:"Безплатно създаване при допустима местна дейност; платен е трудът по настройка.",setup:[100,350],monthly:[0,90],team:"Local SEO"},
{name:"Google Workspace",detail:"Starter €6,80/потребител с годишен план или €8,10 flexible; месечно за всеки платен акаунт.",setup:[50,200],monthly:[7,100],team:"Admin + IT"},
{name:"Google Analytics, Search Console и измерване",detail:"GA4, GSC, UTM, CRM атрибуция и consent setup.",setup:[350,1400],monthly:[70,300],team:"Analytics"},
{name:"Facebook + Instagram (Meta Ads)",detail:"Един рекламен мениджър с отделни формати и кампании.",setup:[250,650],monthly:[400,5000],team:"Performance + Creative"},
{name:"Google Search Ads",detail:"Улавяне на търсене за автомобилни търгове и B2B услуги.",setup:[300,650],monthly:[300,4500],team:"Search Specialist"},
{name:"YouTube / Shorts Ads",detail:"Видео кампании през Google Ads; не са AdSense.",setup:[250,650],monthly:[150,2500],team:"Video + Performance"},
{name:"TikTok Ads",detail:"Пилот само при достатъчен бюджет и съответствие с минималните прагове на Ads Manager.",setup:[250,600],monthly:[600,3500],team:"Video + Performance"},
{name:"Видео Reels и Shorts",detail:"10–30 сек вертикални видеа с реални услуги, екип и автомобили.",setup:[150,500],monthly:[400,2400],team:"Photographer + Editor"},
{name:"SEO и локални B2B страници",detail:"BG/ES съдържание, технически SEO, полезни въпроси и оферти.",setup:[400,1700],monthly:[250,1200],team:"SEO + Content"},
{name:"B2B партньорски outreach",detail:"Реални фирмени интродукции, срещи, CRM и анализ.",setup:[200,800],monthly:[400,2200],team:"Sales + CRM"}
]},
{id:"03",title:"Изкуствен интелект",tagline:"Агенти, оценки, анализи, асистенти",icon:"✳",goal:"AI ускорява работата, но не управлява безконтролно победители или плащания.",team:["AI Engineer","Data Lead","QA","Human Reviewer"],steps:["AI support с източници и човешко предаване","Документна помощ и проверима обработка","Аналитика при законни и достатъчни данни"],risk:"Невалидирана AI оценка не е официална експертиза.",
services:[
{name:"AI Support Assistant",detail:"Помощни отговори, handoff към човек и логове.",setup:[1500,6000],monthly:[100,600],team:"AI + Support"},
{name:"Document Intelligence",detail:"Чернови и проверки по VIN/документи с преглед.",setup:[2200,8000],monthly:[80,500],team:"AI + Legal"},
{name:"AI Pricing Research",detail:"Изследователски модел при проверени пазарни данни.",setup:[5000,20000],monthly:[150,900],team:"AI + Data"}
]},
{id:"04",title:"AR / VR / 3D / 360°",tagline:"Реални автомобилни медии и дистанционен оглед",icon:"◉",goal:"Продаваме доверие чрез доказуеми визуални материали, не чрез чужд демонстрационен автомобил.",team:["Photographer","Editor","3D Artist","QA"],steps:["Стандарт за 20–35 снимки на автомобил","360° фотопреглед на действителен лот","3D/AR само след платен пилот"],risk:"Демо GLB не доказва физическото състояние на колата.",
services:[
{name:"Стандартен фото пакет",detail:"Снимки на интериор, екстериор, документирани щети.",setup:[100,400],monthly:[300,1400],team:"Photographer"},
{name:"360° видео и фотопреглед",detail:"Пилотно заснемане и мобилна оптимизация.",setup:[800,3200],monthly:[200,1100],team:"Media + Frontend"},
{name:"3D модел от реален автомобил",detail:"Фотограметрия, текстури, оптимизация, QA.",setup:[2500,13000],monthly:[150,1100],team:"3D + QA"}
]},
{id:"05",title:"Сървърна инфраструктура",tagline:"Cloud, бази, workers, защита и резерви",icon:"▤",goal:"Надеждни и доказано отделени production/staging среди.",team:["DevOps","Backend","Security"],steps:["Проверка на Vercel → Supabase bindings","Backup/restore, Redis и queue","Натоварване, наблюдение, мащабиране"],risk:"€500 месечна такса за услуга не означава €500 реален облачен разход.",
services:[
{name:"Cloud runtime",detail:"Уеб, база, storage, логи, резерви; според реалната употреба.",setup:[400,2000],monthly:[200,1500],team:"DevOps"},
{name:"Worker/queue/realtime",detail:"Отделни runtime услуги, отказоустойчивост и retries.",setup:[1800,7500],monthly:[80,850],team:"Backend"},
{name:"Monitoring + Recovery",detail:"Аларми, restore drill и SLO.",setup:[900,3500],monthly:[80,450],team:"DevOps + QA"}
]},
{id:"06",title:"Бизнес управление",tagline:"Управление, финанси, KPI и партньори",icon:"▣",goal:"Енчев финансира и одобрява; Митко и Борко ръководят нашите екипи по договор.",team:["Executive","Operations Lead","Finance Analyst"],steps:["Договорни правомощия и матрица на одобрения","Единен P&L и cash flow","Седмичен отчет и бюджетни лимити"],risk:"Предложенията за възнаграждения не са подписани договорки.",
services:[
{name:"Бизнес архитектура",detail:"Управленски модел, KPI, договори, пазари.",setup:[1500,5000],monthly:[400,1800],team:"Strategy"},
{name:"Оперативно управление",detail:"Планиране, vendor management, отчети.",setup:[500,1500],monthly:[2500,6500],team:"Mitko + Borko / договор"}
]},
{id:"07",title:"Продажби и Call Center",tagline:"Автокъщи, дилъри, срещи и CRM",icon:"☎",goal:"Изграждаме пазар с реални купувачи и постоянни продавачи.",team:["Sales Lead","BG Operator","ES Operator","Account Manager"],steps:["Първи 5–10 anchor sellers","Квалифицирани фирмени срещи","Първи обяви → платени сделки"],risk:"Опитите за обаждания не са равни на активирани дилъри.",
services:[
{name:"Оператор BG",detail:"B2B проучвания, срещи, CRM и допустими контакти.",setup:[150,450],monthly:[950,1800],team:"BG Call Center"},
{name:"Оператор ES",detail:"Испански контакти, местна комуникация и onboarding.",setup:[250,550],monthly:[1700,3000],team:"ES Sales"},
{name:"Sales Manager",detail:"Ръководи funnel, договори и повторни сделки.",setup:[250,800],monthly:[1900,4200],team:"Sales Lead"}
]},
{id:"08",title:"Логистика и транспорт",tagline:"Партньори → наш отдел → собствени автовози",icon:"⇄",goal:"Първо чужд транспорт, след рентабилност наш собствен капацитет.",team:["Carrier Partner","Logistics Coordinator","Dispatch","Future Fleet"],steps:["Етап 1: външни лицензирани превозвачи","Етап 2: наш логистичен отдел и диспечери","Етап 3: собствени камиони само след финансов GO"],risk:"Няма предвидена покупка на автовози в началния бюджет.",
services:[
{name:"Carrier Network",detail:"Партньорски договори, оферти, проследяване.",setup:[500,2000],monthly:[250,1100],team:"Logistics Coordinator"},
{name:"Logistics Control Tower",detail:"Транспортни поръчки, документация и dashboards.",setup:[2500,8500],monthly:[150,800],team:"Operations + Engineering"},
{name:"Първи собствен автовоз",detail:"Само отделен инвестиционен сценарий след 3–6 месеца действителна икономика.",setup:[0,0],monthly:[0,0],team:"Future Fleet",phase:"НЕ Е ВКЛЮЧЕНО"}
]},
{id:"09",title:"Правни услуги",tagline:"Договори, регулации, B2B/B2C и KYC",icon:"§",goal:"Юридически GO за всяка държава и отделен режим за real-money operations.",team:["Lawyer BG","Lawyer ES","Compliance Coordinator"],steps:["Marketplace roles и договори","GDPR, DSA, KYC/KYB, AML при приложимост","Страна по страна разрешено стартиране"],risk:"Готови документи не са подписано правно становище.",
services:[
{name:"Marketplace договори",detail:"Правила, купувачи, продавачи, такси и отговорности.",setup:[2000,7000],monthly:[200,700],team:"Legal"},
{name:"Испански правен профил",detail:"Данъчна/корпоративна проверка и местни договори.",setup:[2000,8500],monthly:[300,1100],team:"ES Legal"},
{name:"Privacy/KYB/Compliance",detail:"Правила, доставчици, одобрения и одит.",setup:[1500,5500],monthly:[300,1400],team:"Legal + Compliance"}
]},
{id:"10",title:"Финанси и счетоводство",tagline:"GMV, приходи, ledger, ДДС и cash flow",icon:"€",goal:"Признат приход и плащания без смесване с автомобилния GMV.",team:["Accountant","Finance Ops","PSP","Tax Advisor"],steps:["Principal/agent решение","PSP, escrow/settlement при приложимост","Reconciliation, tax, DAC7 при приложимост"],risk:"Клиентските депозити не са приход на платформата.",
services:[
{name:"Double-entry ledger",detail:"Финансови записи и сверяване.",setup:[4000,15000],monthly:[100,700],team:"Engineering + Finance"},
{name:"Счетоводство BG",detail:"Месечни отчети, данъци, фактури.",setup:[350,1200],monthly:[300,1200],team:"Accountant"},
{name:"ES/International tax",detail:"ДДС, REBU, OSS, DAC7 при приложимост.",setup:[2000,7000],monthly:[400,1600],team:"Tax specialist"}
]},
{id:"11",title:"Киберсигурност",tagline:"IAM, MFA, WAF, pentest и инциденти",icon:"◇",goal:"Никакви критични парични операции без доказани права и възстановяване.",team:["Security Engineer","DevOps","External Pentester"],steps:["Threat model и RLS/API негативни тестове","Webhook signatures и least privilege","Външен pentest, backup/restore и GO"],risk:"RLS enabled не означава проверени политики.",
services:[
{name:"Security baseline",detail:"IAM/MFA, headers, webhook проверки и секрети.",setup:[2500,9000],monthly:[200,900],team:"Security"},
{name:"External penetration test",detail:"Независима проверка преди real-money GO.",setup:[3000,11000],monthly:[0,0],team:"External Security"},
{name:"SOC/monitoring",detail:"Логове, аларми, реакция и reporting.",setup:[1000,4000],monthly:[250,1800],team:"Security + Ops"}
]},
{id:"12",title:"Бизнес автоматизация",tagline:"n8n, queues, workers, approvals и AI",icon:"⚙",goal:"Контролирани автоматизации без права за промяна на победители или ledger.",team:["Automation Lead","Backend","QA"],steps:["Durable queue и outbox","CRM/документни workflows","Financial workflows с човешки одобрения"],risk:"n8n не е авторитетната аукционна система.",
services:[
{name:"n8n пилот",detail:"Интеграции, допустим лиценз, вътрешни workflow задачи.",setup:[1000,3500],monthly:[30,250],team:"Automation"},
{name:"Queue + Workers",detail:"Надеждна асинхронна обработка.",setup:[2000,6000],monthly:[50,300],team:"Backend"},
{name:"Approval Engine",detail:"Одобрения за договорни и финансови операции.",setup:[2000,8000],monthly:[50,250],team:"Product + Backend"}
]},
{id:"13",title:"Международна експанзия",tagline:"България → Испания → ЕС",icon:"◎",goal:"Отваряме пазари само с достатъчно продавачи, купувачи, документи и печеливша икономика.",team:["BG Country Lead","ES Country Partner","Sales","Tax & Legal"],steps:["BG доказателство за реална сделка","Испания: партньори, правен и финансов GO","Следващи държави само по KPI"],risk:"Локализиран сайт ≠ отворен международен бизнес.",
services:[
{name:"BG Pilot Commercial",detail:"B2B партньори, onboarding и продажби.",setup:[1000,4000],monthly:[1000,3500],team:"BG Business"},
{name:"Spain Market Entry",detail:"ES език, партньори, договори, местен координатор.",setup:[5000,18000],monthly:[2500,6500],team:"ES Country"},
{name:"EU Expansion Analysis",detail:"Country-by-country инвестиционен gate.",setup:[1500,5500],monthly:[300,1500],team:"Strategy"}
]},
{id:"14",title:"CRM и обслужване",tagline:"Поддръжка, тикети, SLA, дилъри и спорове",icon:"☏",goal:"Всеки клиент, сделка и проблем с идентификатор и отговорник.",team:["Customer Ops","BG/ES Support","Dealer Success","QA"],steps:["Единни профили и CRM","Ticketing, SLA, knowledge base","Dealer Success и AI handoff"],risk:"Реалният 24/7 support изисква реални смени и бюджет.",
services:[
{name:"CRM и Ticketing MVP",detail:"Клиентски записи, случаи, история и роли.",setup:[5000,16000],monthly:[50,500],team:"Product + Support"},
{name:"BG Support",detail:"Оператори, обучение и QA.",setup:[300,800],monthly:[950,1900],team:"BG Support"},
{name:"ES Support",detail:"Местен език, договорни и финансови ескалации.",setup:[400,1000],monthly:[1800,3200],team:"ES Support"}
]},
{id:"15",title:"Иновации и R&D",tagline:"Инспекции, цени, EV, DPP и визуални модели",icon:"✧",goal:"Разработваме само валидирани технологии с измерим ефект.",team:["R&D Lead","AI/CV","Automotive Expert","Creative"],steps:["Реален Inspection Pack","360° и Computer Vision benchmark","EV/Battery DPP connector при наличие на права"],risk:"DPP за батерия ≠ универсален цифров паспорт за всички автомобили.",
services:[
{name:"Inspection Data Pilot",detail:"Реални снимки, damage map, проверяващ.",setup:[2000,6500],monthly:[100,550],team:"R&D + Inspector"},
{name:"Computer Vision Research",detail:"Анотирани данни, benchmark, human review.",setup:[5000,20000],monthly:[150,850],team:"AI/CV"},
{name:"EV Data Integration",detail:"Диагностични партньори и законно достъпни данни.",setup:[4000,16000],monthly:[100,700],team:"EV Specialist"}
]},
{id:"16",title:"Обучение и персонал",tagline:"Нашите екипи, роли, заплати, HR и академия",icon:"♙",goal:"Наемаме само при натоварване и финансиран договорен капацитет.",team:["Mitko & Borko","HR Coordinator","Team Leads","External Payroll"],steps:["Договорни правомощия и роли","Обучения, сертифициране, IAM","План за BG/ES назначения според сделките"],risk:"Заплатите са брутни/планови, а работодателският разход е по-висок.",
services:[
{name:"HR Setup",detail:"Роли, договори, матрица на правата и onboarding.",setup:[900,3500],monthly:[180,700],team:"HR + Legal"},
{name:"Internal Academy",detail:"Обучения по продажби, support, engineering и security.",setup:[1500,5500],monthly:[100,650],team:"HR + Team Leads"},
{name:"Payroll Coordination",detail:"Външни счетоводители BG/ES при законно назначение.",setup:[300,1100],monthly:[150,700],team:"Payroll"}
]}
];
export const marketConfig={
BG:{title:"България",defaultSpend:{meta:500,search:350,youtube:150,tiktok:0},cpm:{meta:[3,8],youtube:[3,9],tiktok:[2.5,7]},cpc:{search:[0.4,1.8]},staff:{sales:1700,support:1450,marketing:2200},video:130},
ES:{title:"Испания",defaultSpend:{meta:800,search:650,youtube:300,tiktok:0},cpm:{meta:[5,13],youtube:[4,12],tiktok:[3,9]},cpc:{search:[0.8,3.2]},staff:{sales:2900,support:2600,marketing:3300},video:200},
EU:{title:"ЕС — няколко пазара",defaultSpend:{meta:1600,search:1300,youtube:600,tiktok:900},cpm:{meta:[5,16],youtube:[4,14],tiktok:[3,12]},cpc:{search:[1.0,4.5]},staff:{sales:3000,support:2700,marketing:3600},video:230}
} as const;
