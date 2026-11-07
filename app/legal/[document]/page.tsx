import Link from "next/link";
import {notFound} from "next/navigation";
import {enchevLegalStatus} from "../../lib/enchev-legal";
import "./legal.css";

const docs=["terms","privacy","cookies"] as const;
type DocumentType=(typeof docs)[number];
const names:Record<DocumentType,string>={
 terms:"Общи условия",privacy:"Политика за личните данни",cookies:"Политика за бисквитките"
};
export function generateStaticParams(){return docs.map(document=>({document}));}
export async function generateMetadata({params}:{params:Promise<{document:string}>}){
 const {document}=await params;
 return {title:(names[document as DocumentType]||"Правни документи")+" | E&A"};
}
export default async function LegalDocument({params}:{params:Promise<{document:string}>}){
 const {document}=await params;
 if(!docs.includes(document as DocumentType))notFound();
 const status=enchevLegalStatus();
 const title=names[document as DocumentType];
 const operator=status.entityName||"Не е окончателно посочен";
 const contact=status.contactEmail||"Не е публикуван";
 return <main id="main-content" className="eaLegalPage">
   <header className="eaLegalHeader">
    <Link href="/" aria-label="Към началото"><b>E<span>&</span>A</b><small>EAST AND WEST<br/>AUCTIONEERS GROUP</small></Link>
    <nav aria-label="Правни документи">{docs.map(type=><Link href={"/legal/"+type} key={type} aria-current={document===type?"page":undefined}>{names[type]}</Link>)}</nav>
   </header>
   <article className="eaLegalArticle">
    <small className="eaLegalEyebrow">E&A / ПРАВНА ИНФОРМАЦИЯ · Версия {status.version}</small>
    <h1>{title}</h1>
    {!status.approved&&<div className="eaLegalWarning" role="status"><strong>ПРОЕКТ — НЕ Е ОКОНЧАТЕЛНО ОДОБРЕН</strong><p>Този документ описва планираните правила, но не представлява утвърдени договорни условия. Регистрацията не се активира, докато юридическата проверка и данните на оператора не бъдат завършени.</p></div>}
    <div className="eaLegalSection"><h2>Кой управлява платформата?</h2><p>E&A East and West Auctioneers Group е търговското наименование на платформата. Юридическото лице, неговият регистрационен номер, адрес и контакт трябва да бъдат потвърдени преди публична регистрация.</p><dl><dt>Оператор</dt><dd>{operator}</dd><dt>Рег. номер</dt><dd>{status.registrationNumber||"Предстои потвърждение"}</dd><dt>Адрес</dt><dd>{status.registeredAddress||"Предстои потвърждение"}</dd><dt>Имейл за контакт</dt><dd>{contact}</dd></dl></div>
    {document==="privacy"&&<>
      <section className="eaLegalSection"><h2>1. Какви данни се обработват?</h2><p>При регистрация: име, фамилия, държава, телефон, имейл, тип акаунт и посочени фирмени данни, ако са приложими. Паролите се обработват от услугата за удостоверяване и не се съхраняват в базата за профили като текст. Може да се обработват технически данни за сигурност и регистрации на събития при достъп.</p><p>Документи за самоличност, фирмени проверки, плащания и търгове ще изискват отделни обяснения и проверки, преди функциите да бъдат активирани.</p></section>
      <section className="eaLegalSection"><h2>2. Защо се обработват?</h2><p>За създаване и управление на акаунт и за изпълнение на заявената услуга; за защита от злоупотреба и сигурност; при приложимо законово задължение за проверка и отчетност; за маркетинг само след отделен, свободно даден избор. Конкретните основания по чл. 6 GDPR се определят според всяка операция.</p></section>
      <section className="eaLegalSection"><h2>3. Получатели, международни трансфери и срокове</h2><p>Техническата инфраструктура използва хостинг и услуги за удостоверяване. Преди активация операторът трябва да опише действителните обработващи лични данни, държавите и механизмите за трансфер, конкретните срокове за съхранение и правилата за изтриване. Не се твърди, че неопределени срокове или получатели са вече одобрени.</p></section>
      <section className="eaLegalSection"><h2>4. Вашите права</h2><p>При приложимите законови условия имате право на достъп, коригиране, изтриване, ограничаване, преносимост, възражение и оттегляне на незадължително съгласие, без това да засяга предходното законосъобразно обработване. Може да подадете жалба до съответния надзорен орган за защита на данните, включително КЗЛД в България.</p></section>
      <section className="eaLegalSection"><h2>5. Маркетингово съгласие</h2><p>Рекламните съобщения са по избор. Отказът не спира създаването на акаунт. Преди изпращане на маркетинг трябва да има работещ механизъм за отписване и регистър на предпочитанията.</p></section>
    </>}
    {document==="terms"&&<>
      <section className="eaLegalSection"><h2>1. Профил и достъп</h2><p>Регистрацията е предназначена за лица над 18 години. Потребителят предоставя верни данни, съхранява сигурно паролата и уведомява за неоторизиран достъп. При фирмен акаунт са необходими допълнителни проверки за представителство и фирмена идентификация (KYB).</p></section>
      <section className="eaLegalSection"><h2>2. Автомобилни търгове</h2><p>Преди реални оферти потребителят следва да получи ясно посочени условия за достъп до търгове, депозити, такси, наддаване, обвързващ характер на оферти, срокове, анулиране и разрешаване на спорове. В демо режима не се извършват действителни покупки и плащания. Реалното наддаване изисква изрично активиране и проверки.</p></section>
      <section className="eaLegalSection"><h2>3. Цени, плащане, транспорт</h2><p>Преди обвързваща покупка трябва да бъдат показани приложимите такси, данъци, транспортни разходи, данни за продавача, методи за плащане и доставка. Отделно се определят правилата за рекламации, законова гаранция и право на отказ — според конкретната сделка и дали продавачът е търговец. Няма общо правило, че всяка онлайн покупка на употребяван автомобил е без право на отказ.</p></section>
      <section className="eaLegalSection"><h2>4. Поведение и сигурност</h2><p>Не са позволени неверни регистрационни данни, манипулиране на търгове, достъп до чужди акаунти или опити за заобикаляне на проверки. Преди публичен старт са нужни окончателни правила за спиране на профили, жалби и обжалване на решения.</p></section>
      <section className="eaLegalSection"><h2>5. Приложимо право и жалби</h2><p>Действителното юридическо лице, приложимите държавни правила, потребителските права и механизмът за контакт и жалби трябва да бъдат публикувани преди договорно обвързване. Нищо тук не ограничава императивни права на потребителите.</p></section>
    </>}
    {document==="cookies"&&<>
      <section className="eaLegalSection"><h2>1. Необходими бисквитки</h2><p>Системата за удостоверяване предвижда защитени сесийни бисквитки, необходими за входа и сигурността. Те не се използват за маркетинг чрез този формуляр.</p></section>
      <section className="eaLegalSection"><h2>2. Незадължителни технологии</h2><p>Преди активиране на анализи, реклама или други незадължителни бисквитки трябва да бъдат проверени реалните инструменти и да бъде предоставен механизъм за предварително съгласие и лесно оттегляне. Този документ не твърди, че е извършен окончателен технически одит на всички скриптове.</p></section>
      <section className="eaLegalSection"><h2>3. Настройки на браузъра</h2><p>Можете да управлявате или изтривате бисквитки от настройките на своя браузър. Ограничаването на необходимите сесийни бисквитки може да попречи на входа.</p></section>
    </>}
    <footer className="eaLegalFooter"><p>Текстовете са проект за юридическо потвърждение, а не индивидуален правен съвет. Официални източници: <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noopener noreferrer">GDPR</a> · <a href="https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm" target="_blank" rel="noopener noreferrer">Европейски потребителски правила</a>.</p><Link href="/register">← Към регистрацията</Link></footer>
   </article>
 </main>;
}
