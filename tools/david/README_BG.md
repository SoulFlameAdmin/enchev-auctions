# DAVID → ChatGPT auto-continue за Enchev Auctions

Този worker е локален помощник. Той НЕ е част от production приложението и не участва в auction runtime-а.

## Фиксирана ChatGPT сесия

`https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71`

## Как работи

1. Свързва се към отделен Microsoft Edge профил през локален CDP порт `9444`.
2. Отваря само фиксираната Enchev ChatGPT сесия.
3. Чака най-новият assistant отговор да приключи и да стане стабилен.
4. Изпраща инструкция ChatGPT да продължи следващата реална задача от `MASTER SYSTEM PLAN v1.0 FROZEN` и GAP точките.
5. Инструкцията изисква директно използване на `@GitHub @Vercel @Supabase`, когато са приложими.
6. Ако ChatGPT върне точния маркер `[[DAVID_STOP]]`, worker-ът спира за човешко решение.
7. По подразбиране спира и след 30 автоматични цикъла.

## Първо стартиране

От PowerShell в repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\david\start-auto-continue.ps1
```

Ако се отвори нов Edge профил и ChatGPT поиска login, логни се ръчно веднъж. След това затвори worker-а с `Ctrl+C` и пусни същата команда отново.

За по-малък лимит:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\david\start-auto-continue.ps1 -MaxTurns 10
```

## Защо има STOP marker

Автоматизацията не трябва сама да преминава през:

- нов платен ресурс или потвърждение на разход;
- secret/password/API key;
- MFA, CAPTCHA или login;
- destructive/необратимо действие;
- правен sign-off;
- security exception;
- липсващ достъп.

В тези случаи ChatGPT е инструктиран да завърши с `[[DAVID_STOP]]` и DAVID не изпраща следващо „Продължи“.

## State

Worker-ът пази локално `.david-enchev-state.json` в `tools/david`. Ако искаш напълно нов automation run, спри worker-а и изтрий само този state файл.

## Важно

Не използвай worker-а за заобикаляне на rate limits, account ограничения, CAPTCHA или други защити на ChatGPT. Ако платформата покаже limit/error/verification, worker-ът спира.
