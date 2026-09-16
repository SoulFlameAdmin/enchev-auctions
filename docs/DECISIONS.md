# Решения

- ADR-001: Readiness е функция на задължителните тестове за конкретния commit. Няма mutable localStorage статуси и няма публичен write endpoint за readiness.
- ADR-002: Next.js App Router + TypeScript strict, фиксирани версии и lockfile. `npm run build` изпълнява unit/security/configuration проверките преди build.
- ADR-003: Начални пазари BG/EN + EUR. Money е integer minor units плюс валута и precision; timestamp е UTC/offset; UI използва конфигурируема IANA зона. Това е foundation, не завършен многоезичен marketplace.
- ADR-004: Auction bids, proxy bids, deposits, exposure и finalization трябва да са атомарни PostgreSQL transactions. Не се допуска in-memory bidding lock в serverless приложение.
- ADR-005: Добавена е само `enchev_development_events` към съществуващата инфраструктура за техническо проследяване. Няма промени в други продуктови таблици. Auction/customer/payment данните изискват изолирани preview и production проекти.
- ADR-006: GitHub OIDC удостоверява CI publisher: issuer, audience, RS256, срок, неизменни repository/owner IDs, exact workflow, ref main/staging и event push/workflow_dispatch. Commit и run ID идват от подписания token. Публичен read показва само структурирани технически резултати; никога raw logs, credentials или personal data.
- ADR-007: UI polling на 15 секунди; RUNNING events се пазят durable и timeout след 30 минути се отчита като FAIL. Public browser не изпълнява CI и не маркира готовност.
- ADR-008: Зелено изисква реализиран етап, липса на blockers и всички required tests PASS. Непознат тест, NOT RUN, FAIL и резултат от друг commit не дават зелено. Общият процент никога не достига 100 при непокрит gate.
- ADR-009: Промени: staging → CI → Vercel Preview → smoke → fast-forward main. Branch protection все още трябва да се активира през GitHub administration; този connector няма administration API.
- ADR-010: Registry ≠ executable coverage. Изградените тестове проверяват dashboard/foundation. Тестовете за липсващи auction modules са NOT RUN и ще получат реална имплементация заедно с модулите.
