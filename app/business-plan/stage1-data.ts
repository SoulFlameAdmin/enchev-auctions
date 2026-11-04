import {sections} from "./data";
import {detailed,enabledByLevel,lineCost} from "./master-plan-data";

export type Stage1Offer = {
  id:string;
  title:string;
  description:string;
  includes:string[];
  setupExpense:number;
  setupLabor:number;
  monthlyExpense:number;
  monthlyLabor:number;
  enabled:boolean;
  expenseLabel:string;
};

type Preset=Omit<Stage1Offer,"id">;
const marketing:Preset[]=[
  {title:"Google Ads",description:"Рекламни кампании, ключови думи, управление и измерване на резултатите.",includes:["Google Search реклама за автомобили, дилъри и аукциони","Настройване на кампании, аналитика и проследяване","Седмична оптимизация на бюджет и заявки"],setupExpense:150,setupLabor:150,monthlyExpense:500,monthlyLabor:250,enabled:true,expenseLabel:"Рекламен бюджет"},
  {title:"Facebook и Instagram Ads",description:"Съвместни Meta кампании за реални продавачи и купувачи.",includes:["Рекламен акаунт Meta и отделни аудитории","Реклами за дилъри, автомобили и първи търгове","A/B тестове на рекламни материали"],setupExpense:100,setupLabor:150,monthlyExpense:500,monthlyLabor:250,enabled:true,expenseLabel:"Рекламен бюджет"},
  {title:"Видео, Reels и монтаж",description:"6 кратки видеа на месец за Meta, Shorts и TikTok.",includes:["Сценарий, заснемане и монтаж на 6 видеа","Вертикални варианти и субтитри","Одобряване и подготвяне за публикуване"],setupExpense:150,setupLabor:100,monthlyExpense:780,monthlyLabor:200,enabled:true,expenseLabel:"Видео производство"},
  {title:"Google Workspace, CRM, Twilio",description:"Служебни акаунти, управление на контакти и планирани телефонни разговори.",includes:["Google Workspace за началните служебни акаунти","CRM контакти, етапи и отговорници","Twilio: бюджетен резерв за телефонни разговори — активира се след разрешен акаунт"],setupExpense:180,setupLabor:180,monthlyExpense:220,monthlyLabor:150,enabled:true,expenseLabel:"Софтуер и телефония"},
  {title:"YouTube и Shorts Ads",description:"Платено видео разпространение през Google Ads, различно от AdSense.",includes:["Кратки видео реклами","Насочване към подходящи аудитории","Проследяване на гледания и лийдове"],setupExpense:100,setupLabor:100,monthlyExpense:150,monthlyLabor:120,enabled:true,expenseLabel:"Рекламен бюджет"},
  {title:"TikTok Ads",description:"Допълнителен тест след проверка на минималния бюджет и реалните резултати.",includes:["Вертикални рекламни креативи","Проверка на изискванията за минимален бюджет","Тестова кампания при одобрено финансиране"],setupExpense:0,setupLabor:0,monthlyExpense:0,monthlyLabor:0,enabled:false,expenseLabel:"Рекламен бюджет"},
  {title:"Google Business Profile",description:"Безплатен бизнес профил при допустим реален местен бизнес.",includes:["Проверка за допустимост на фирмата","Настройка, снимки, категория и контактна информация","Поддръжка и отговори на запитвания"],setupExpense:0,setupLabor:100,monthlyExpense:0,monthlyLabor:50,enabled:true,expenseLabel:"Google такса"},
  {title:"SEO и локално съдържание",description:"Техническа оптимизация, търсене и полезни страници на български.",includes:["Оптимизирани продуктови и информационни страници","Search Console и аналитични проверки","Седмични подобрения на съдържанието"],setupExpense:300,setupLabor:200,monthlyExpense:250,monthlyLabor:150,enabled:true,expenseLabel:"Инструменти и съдържание"},
  {title:"B2B партньорски маркетинг",description:"Дилърски представяния, контакти и CRM проследяване.",includes:["Списък с допустими автокъщи","Лично представяне, срещи и договорни заявки","Измерване на проверени активни партньори"],setupExpense:150,setupLabor:150,monthlyExpense:350,monthlyLabor:200,enabled:true,expenseLabel:"Кампании и материали"}
];

const custom:Record<string,Preset[]>={
  "02":marketing
};

export const stage1Areas=sections.map(section=>{
  const generated:Preset[]=section.services.flatMap((service,index):Preset[]=>{
    const calc=lineCost(section,service,index);
    const track=detailed[section.id].tracks[index%detailed[section.id].tracks.length];
    if(!enabledByLevel(calc,"bg"))return [];
    const monthlyRaw=service.monthly[0];
    const setupRaw=service.setup[0];
    const mainlyPeople=calc.laborByRoster;
    return [{
      title:service.name,
      description:service.detail,
      includes:track.tasks.slice(0,3),
      setupExpense:Math.round(setupRaw*0.72),
      setupLabor:Math.round(setupRaw*0.28),
      monthlyExpense:mainlyPeople?0:Math.round(monthlyRaw*0.7),
      monthlyLabor:mainlyPeople?monthlyRaw:Math.round(monthlyRaw*0.3),
      enabled:true,
      expenseLabel:mainlyPeople?"Други разходи":"Услуга / доставчик"
    }];
  });
  return {
    id:section.id,
    title:section.title,
    tag:section.tagline,
    icon:section.icon,
    goal:section.goal,
    risk:section.risk,
    offers:(custom[section.id]??generated).map((offer,index)=>({...offer,id:section.id+"."+String(index+1).padStart(2,"0")}))
  };
});
export type Stage1Area=(typeof stage1Areas)[number];
