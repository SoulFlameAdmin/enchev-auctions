# Enchev Auctions

Автомобилна аукционна платформа в разработка. **Не е готова за реални търгове или плащания.**

## Локална работа

Node 24: `npm ci`, `npm run dev`. Проверка: `npm run build`. След build стартирайте `npm run start`, после `npm run smoke` в отделен терминал.

## Етапи

Burger → Етапи отваря целия технически план, Test Center, CI/deployment activity и Decision Log. Няма ръчно маркиране като готово. Статусът се пресмята само от тестови доказателства за текущия commit.

- `data/plan.json`: 28 етапа, blockers и задължителни тестове.
- `scripts/verify.mjs`: реални foundation проверки и build evidence.
- `scripts/smoke.mjs`: API, HTTP, no-cache и отказ на публичен write.
- `.github/workflows/ci.yml`: reproducible install → verify/build → runtime smoke → artifact.
- `generated/evidence.json`: регенерира се при build; стартовият файл няма PASS.
- `/api/development-status`: server-derived status; опресняване на 15 секунди.
- `/api/health`: само web health, не доказва auction readiness.

## Cloud evidence

GitHub CI публикува RUNNING/PASS/FAIL с GitHub OIDC към `enchev-development-status`. Няма дълготраен secret в GitHub. Function валидира GitHub JWT и exact repo/workflow/ref и записва в отделна RLS таблица. Само безопасни структурирани резултати са публични. Не изпращайте raw logs или лични данни.

За бъдещи тестове обновете едновременно test registry, реалния runner и allowlist в Edge Function. Промените във функцията се deploy-ват отделно и се проверяват. Не отбелязвайте несъществуващ module като implemented.

GitHub/Vercel API feeds могат допълнително да се включат с server-only read tokens от `.env.example`. Основният CI evidence feed работи чрез OIDC. Env values не се показват в browser.

## Среда и release

`staging` е Vercel Preview; `main` е production branch. След staging CI и smoke може fast-forward към main. GitHub branch protection остава незавършен gate, докато не бъде реално активиран. Никога не използвайте реални плащания за тестове.

В `.env.example` са нужните бъдещи интеграции. Auction данните трябва да използват изолирани Supabase preview/production проекти. Миграцията за development evidence е самостоятелна и не създава auction backend.

Вижте `docs/AUDIT.md` и `docs/DECISIONS.md`.
