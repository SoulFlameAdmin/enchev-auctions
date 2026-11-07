# ENCHEV AUCTIONS — Спешен план 119 дни · FOUNDATION HARDENING V2
**Одит:** 2026-11-07 · **Изпълнение:** D003 BLOCKED; D004 NO-GO за тестови записи; D005 Redis/Valkey NOT READY.  
**Source of truth:** `app/data/urgent-119-days.json` (119 неизменени ID, 17 седмици, 799 планирани екипни часа), `app/data/urgent-auction-architecture-119-v1.json`, `docs/MASTER_SYSTEM_PLAN_V1_FROZEN.md`.  
**Промяната:** Това е *допълнителен договор за приемане и приоритети*, не втори план, не преномерира D001–D119, не дава разрешение за реални плащания, и не променя вече доказано приети резултати.  
**Каноничен Enchev Supabase:** `ejfrnjhlggebzmpmxajl`; **staging branch ref:** `jranctnafndbqzrwcwos`; **Vercel project:** `prj_X3TAEQf9oGE79te9NdNlvB6jnhno`.

## 1. Решение за изпълнение

**GO за безопасни одит, разработка, тестове и подготовка; NO-GO за реални търгове, депозити, плащания, изплащания и купувачески документи за истинска сделка.** 1 март 2027 е цел за *контролирана бета само при подписан GO*; иначе sandbox/demo, без финансови операции. Никакво обещание, че 119 календарни дни гарантират завършена международна платформа.

### Задължителни инварианти
1. **Enchev-only data:** реални клиентски, финансови, аукционни, административни данни и плановите му доказателства са в собствен Enchev Supabase; не в SoulFlame/Twins. Идентифицираният legacy `CloudPlanStateSync.tsx` все още сочи към `frhletkiuupgksmgxoxc`. Съществува Enchev edge endpoint `enchev-plan-state`, но неговите права/формат/интервали трябва да се тестват, преди да се премести визуалният sync. Без общи или публични административни записи.
2. **No production test writes:** Preview се свързва само с отделна staging DB; не се пишат фиктивни лотове в Production.
3. **No customer money until GO:** Payment/Deposit/Release остават OFF до одобрени условия, KYC/KYB, точна поръчка/фактура, sandbox provider webhooks/ledger, reconciliation и security review.
4. **PostgreSQL is auction authority:** клиентски таймер, cookies, WebSocket, Redis и AI не определят приета оферта, печеливша сума или победител.
5. **Evidence-only GREEN:** CI/HTTP 200 не доказват конкретно бизнес поведение; приема се само със системен тест, отрицателен тест, независим артефакт и, когато е приложимо, подпис на отговорния.
6. **No silent data mutation:** миграциите първо се проверяват на staging, имат rollback/backup, не изтриват съществуващи SoulFlame/DAVID таблици без миграционен план и изрично одобрение.

## 2. P0: ДЕН 3 — Vercel Environment Variables + Supabase

**Текущи доказателства:** Vercel `filter_project_envs` връща HTTP 403; точните bindings и права на Production/Preview не могат да бъдат независимо прочетени. Supabase `enchev-staging` branch ID `248ecd54-771a-4830-a7ab-4a29cb81bb32` е `FUNCTIONS_DEPLOYED`, `preview_project_status=ACTIVE_HEALTHY`, `with_data=false`, **`persistent=false`**. `get_project(staging-ref)` не е достъпен от текущия connector; branch metadata е налична през parent.

### Ръчна настройка от упълномощен Vercel администратор
1. Отвори **Vercel → Project enchev-auctions → Settings → Environment Variables**. Ползвай само точния проект, не друг проект със сходно име.
2. Избери **Production** за `main` и **Preview** за определен НЕ-`main` Git branch. Не добавяй secrets във всички Preview клонове, ако може да се зададе branch scope. Потвърди, че Preview не наследява production endpoint/secret.
3. За съществуващия Етап 1 runtime провери следните имена, **само ако съответните server modules ги използват**:
   - `ENCHEV_ETAP1_PROJECT_REF`: Production `ejfrnjhlggebzmpmxajl` / Preview `jranctnafndbqzrwcwos`.
   - `ENCHEV_ETAP1_SUPABASE_URL`: Production `https://ejfrnjhlggebzmpmxajl.supabase.co` / Preview `https://jranctnafndbqzrwcwos.supabase.co`.
   - `ENCHEV_ETAP1_SERVICE_ROLE_KEY`: **отделният ключ за съответната среда**, единствено server-side; никога в браузър, GitHub или чат.
4. За купуваческия Auth модул `app/lib/enchev-auth-server.ts` прегледай:
   - `ENCHEV_AUTH_PROJECT_REF`: Production `ejfrnjhlggebzmpmxajl`; Preview `jranctnafndbqzrwcwos`.
   - `ENCHEV_AUTH_URL`: HTTPS URL към точно същия ref.
   - `ENCHEV_AUTH_ANON_KEY`: publishable/anon key, отделен за всяка среда, server-side configuration.
   - `ENCHEV_AUTH_SITE_ORIGIN`: каноничния HTTPS адрес на конкретната среда, напр. Production `https://enchev-auctions.vercel.app` и точния Preview HTTPS адрес. Не използвай Production origin за Preview, ако връзките за потвърждение трябва да останат в staging.
   - `ENCHEV_AUTH_ENABLED`: **`false` до одобрение и успешен тест на законовите условия и изолацията**. Не включвай `true` само за да мине health checker.
5. Проверка на юридическия gate `app/lib/enchev-legal.ts`: `ENCHEV_LEGAL_ENTITY_NAME`, `ENCHEV_LEGAL_REGISTRATION_NUMBER`, `ENCHEV_LEGAL_REGISTERED_ADDRESS`, `ENCHEV_LEGAL_CONTACT_EMAIL`, `ENCHEV_LEGAL_POLICIES_APPROVED`, `ENCHEV_LEGAL_REVIEWED_VERSION`. **Никога не поставяй фиктивна фирма/одобрение в Production**. Версията от кода към този одит е `2026-11-07-v1`; изисква действително юридическо одобрение.
6. Не изписвай и не изпращай никакви ключове/стойности. Доказателство е *санитиран списък на variable **names**, scopes, last updated*, branch-target map, provider audit и runtime tests.
7. Приложи промените чрез съзнателно разрешен redeploy на правилната среда, после провери server-side runtime target със защитен health endpoint без излагане на ключове, negative cross-project test, RLS/auth тестове и миграционната история. Виж 7-те D003 gates в `config/urgent-D003-db-binding-audit.json`.

**Защо не е GREEN:** В момента 4/7 gate checks от D003 одита са доказани; липсва live Env metadata / production-preview binding / role isolation и governance доказателство. Статични source values не са достатъчни.

## 3. P0: ДЕН 4 — безопасен staging dry run

Изпълнява се **само след D003 acceptance**:
- Потвърди staging `jranctnafndbqzrwcwos` е активен и договорът за persistent staging е одобрен (епизодичен branch не е надеждна дълготрайна staging среда).
- Reproducible migrations, check от чиста база, без secret values или production fixtures.
- Snapshot/backup или друг проверен recovery подход за staging преди тестовите записи.
- One synthetic seller, one synthetic vehicle, one lot only in staging, with linked documents and role constraints.
- Test `Preview -> staging`, `Production -> production`, reject `Preview -> production`; забрани unsafe service-role use от browser.
- Пълно изчистване само на изрично обозначените synthetic fixtures при нужда; никакво Production изменение.
- PASS evidence: sanitized target refs, commit/CI, read-only counts before-after в staging и 0 production fixture writes.

## 4. P0: ДЕН 5 — Redis/Valkey binding

Runtime `/api/health/redis-env`: **0** candidate keys. `/api/health/redis`: HTTP **503**, `missing-redis-binding`.  
Изисква се действителен provider, отделни credentials по среда и PING/PONG:
- Една от поддържаните форми: TLS `REDIS_URL`; или `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`; или `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
- Staging първо, Production след одобрение. Няма фиктивни тайни и няма Redis вместо PostgreSQL при определяне на победителя.

## 5. Укрепване на графика — без преномериране

| Поток | Първи ден / първоначален диапазон | Затегнато изискване |
|---|---|---|
| A. Identity / Foundation | D003–D014 | Сигурност (RLS, изолация, MFA за admin, backup plan) започва **сега**, не чак при D085; legal identity gate преди истински signup |
| B. Seller / Vehicle | D015–D028 | Одобрен продавач + право за продажба, anti-fraud, object storage & upload validation, пълни декларации |
| C. Auction | D029–D056 | Сървърно authority, adversarial concurrency, exactly-once finalizer и reconnect; не използвай demo като real |
| D. Commercial / Legal | Подписите са D071–D077 | **Работата по договори, ДДС, AML и PSP onboarding започва паралелно още D008**, без да се маркират бъдещи D071–D077 като GREEN |
| E. Payments / Documents | D057–D084 | Договорени fee/tax правила преди търговия; sandbox PSP рано, подписан webhook, refund/dispute, reconciliation |
| F. Security / Operations | D085–D091 | Първи RLS/role/upload и disaster readiness gate сега; независимо повторно тестване на D085–D091 |
| G. Pilot / Launch | D092–D119 | Една законна пилотна кола; D118 signed GO по legal, finance, security, operations; else DEMO only |
| H. Governance isolation | Паралелен P0 GAP | Планирай миграция на legacy plan-state sync от shared SoulFlame endpoint към собствен Enchev; прегледай смесените `sf_*`, `david_*` таблици без destructive operations |

**Капацитет:** 119 дни × 47 часа/седмица = 799 екипни часа; в оригинала няма реален резерв. За управление е нужен отделен risk/contingency буфер ~20–30% (160–240 екипни часа), без да се твърди, че тази работа вече е бюджетирана или платена. PSP/юридически срокове зависят от външни одобрения. При отклонение срокът за реална бета се измества; демо пускането може да остане отделно. Тест на 50–100 участника в D090 **не доказва** капацитет за 5 000 едновременни участници; това е отделен performance gate за мащабиране.

## 6. Задължителни общи gates

**G0 — Configuration & Isolation:** D003 реално преминава всички 7 приемателни проверки и D004 безопасен staging тест.  
**G1 — Identity:** D014 E2E с 3 акаунта/2 роли, отказан купувач и отрицателни cross-account тестове.  
**G2 — Valid Listing:** D021 approve/reject Seller→Vehicle→Lot без production fixture data.  
**G3 — Auction Authority:** D042, D049 и D056: atomic bid, one winner, 3+ clients, disconnect/retry, server clock.  
**G4 — Commercial:** D070 signed closed demo, D077 правен и финансов GO, действително потвърдени условия на търг и комисиони.  
**G5 — Payments:** D084 10/10 sandbox теста с нулеви необяснени разлики, подписан PSP webhook, idempotency, refund/dispute, release only when paid.  
**G6 — Security:** D085–D091 без неотстранен Critical/High, restore test, RLS/Auth/MFA/IDOR/BOLA, measurable SLO.  
**G7 — Real pilot:** D092–D098 само при подписан GO; иначе само sandbox dry run.  
**G8 — Production launch:** D109, D112, D114, D116 и D118 завършени с доказателства; обвързващите подписи включват закон, финанси, сигурност и операции.

Правило: статус на ден = GREEN само при original PASS + всички приложими допълнителни критерии + реални доказателства; не се приемат следващи дни при неприет непосредствен предшественик без изрично, документирано разрешение за независима, не-production подзадача. Исторически приетите резултати не се изтриват.

## 7. Какво да се направи сега

1. D003: изискай разрешения за Vercel env metadata / потвърждение от администратор; разгледай **само имена, среда и Git branch scope**, без secret values.
2. D003: валидирай точната Preview→staging и Production→production карта. При 403 задачата остава BLOCKED.
3. D004: без никакви тестови записи, докато D003 е BLOCKED. Подготви единствено schema-check, fixtures manifest, backup и negative tests offline.
4. D005: избери Redis/Valkey доставчик и настрой отделни staging + production credentials през упълномощен човек/provider; live PING е gate.
5. D008: започни юридическо и бизнес решение за роли, комисиони, депозити и първия пилот; свържи D071–D077 предварителните външни зависимости.
6. Никакви реални плащания/аукциони или автоматично маркиране на GREEN.

**Проверка към датата:** web/API 200, auth available=false, legalReady=false, catalog 503, Redis 503, realtime 503, worker 503, payment live/deposit/requests=false. Публичният сайт е достъпен; това не е production-buyer readiness.
