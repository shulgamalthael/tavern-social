# Tavern Backend — Project Context

Что есть в backend этого репозитория **сейчас** — карта модулей и текущий
статус AI-инициативы. Как с этим работать — `backend/AGENTS.md`. Планы
конкретных инициатив (что ещё строится и почему) — `ROADMAP.md` (платформа)
и `AI_PLATFORM_ROADMAP.md` (AI-слой) в корне репозитория.

## Что это

NestJS API для Tavern — социальной сети с надстройкой "Business Automation
OS": AI-конструктор сайтов, коммерция, бронирование, CRM-примитивы, бизнес-
автоматизация (Rules Engine), и растущий AI-оркестрационный слой поверх
всего перечисленного. Frontend — Next.js 16 App Router (`frontend/`),
обращается к этому backend только серверным кодом (Server Actions/Route
Handlers), никогда напрямую из браузера.

## Модель мультитенантности

Нет "workspace"/"team" — `User.businesses: Business[]`, один владелец на
бизнес, `Business.ownerId === request.user.id` — единственная граница
изоляции во всём проекте (см. `AGENTS.md` §3). Каждый бизнес — ровно один
`Website` (1:1).

## Карта модулей (`src/modules/*`, маршрут → назначение)

**Идентичность и социальная часть** (не специфично для Business OS):
- `auth` (`/auth`) — регистрация/логин/логаут, opaque Redis-сессии.
- `users` (`/users`) — профили.
- `friends`, `groups`, `communities`, `threads`, `posts` — социальный граф,
  сообщения, лента, группы/сообщества.
- `gallery` (`/users`) — медиа-галерея профиля.
- `search` (`/search`) — поиск по сущностям соцсети.
- `notifications` (`/notifications`, `/businesses/:id/notifications`) —
  единая модель `Notification`, два контроллера (личная лента vs.
  бизнес-специфичный `rule_triggered`-фид, см. §15.4 `AI_PLATFORM_ROADMAP.md`).

**Ядро Business OS:**
- `businesses` (`/businesses`) — CRUD бизнеса; `create` создаёт бизнес +
  пустой сайт одной транзакцией.
- `websites` (`/businesses/:id/website`) — черновик/публикация JSON-документа
  сайта (`WebsiteDocument`: страницы → блоки → `props`/`style`).
- `domains` (`/businesses/:id/domains`) — кастомные домены + верификация.
- `public-sites` (`/sites`) — **публичный**, без авторизации: рендер сайта
  посетителю, оформление заказа/записи/формы анонимным визитором.
- `media-assets` (`/businesses/:id/media`) — загруженные файлы.

**Commerce/Booking/Content** (`ROADMAP.md`, Phases 5-7):
- `products`, `orders`, `discounts`, `pricing` (движок расчёта цены/скидки,
  без собственного HTTP-контроллера) — Commerce.
- `services`, `appointments` — Booking.
- `blog-posts`, `form-submissions` — Content/Forms.
- `currencies` — справочник поддерживаемых валют, без контроллера.
- `payments` (`modules/payments`) — `PaymentProvider`/`StripeAdapter`,
  разовые платежи заказов/записей, вебхук `/webhooks/stripe`.
- `analytics` (`/businesses/:id/analytics`) — `page_view`/`order_created`/
  `appointment_created`/`form_submission` события, сводки для Dashboard.

**Payment Plans (подписка на саму платформу — не путать с Commerce/`payments` выше):**
- `billing` (`/businesses/:id/billing`, `/webhooks/stripe-subscriptions`) —
  `BusinessSubscription` (текущий тариф), `PlanSelectionEvent` (append-only
  аудит), `StripeSubscriptionProvider`/`StripeSubscriptionAdapter` —
  Stripe Checkout Subscriptions для Starter/Business/Scale, мгновенная смена
  цены существующей подписки при переключении между платными тирами,
  немедленная отмена при переходе на Free. 5 статичных тиров
  (Free/Starter/Business/Scale/Enterprise), маркетинговый копирайт тиров —
  только на frontend (`entities/subscription`), backend не отдаёт каталог
  по HTTP. Гейт конструктора (нельзя открыть Builder без выбранного тарифа)
  — на frontend, server-side (`business/[id]/edit/page.tsx`), не здесь.

**Автоматизация и расширяемость:**
- `rules` (`/businesses/:id/rules`) — Business Logic Engine v1: `Rule
  { trigger, condition (AND/OR/nested), actions }`, вычисляется синхронно
  сразу после `order_completed`/`appointment_booked`/`form_submitted` в
  соответствующем контроллере. Три действия: `send_notification`,
  `add_loyalty_points`/`set_membership_tier` (пишут в
  `CustomerLoyaltyAccount`, покупатель идентифицируется по `customerEmail`
  на заказе/записи; `GET .../rules/loyalty-accounts` — чтение владельцем).
- `custom-widgets` (`/businesses/:id/widgets`) — сохранённые именованные
  композиции существующих типов блоков (не исполняемый код), вставляются в
  страницу снапшотом (без живой синхронизации при редактировании виджета).
- `web3` (`/businesses/:id/web3`) — AI_PLATFORM_ROADMAP.md §2.6, AI-7:
  read-only витрина баланса/NFT кошелька, который владелец сам указал для
  бизнеса (`Business.web3WalletAddress`). `Web3Provider`/`AlchemyAdapter`
  (прямой fetch к Alchemy, без SDK, тот же приём, что `GeminiAdapter`). НЕ
  кошелёк покупателя/визитора сайта и не приём крипто-платежей — тот поток
  (client-side wallet-signed подтверждение, wagmi/viem) осознанно вне этой
  итерации. **API-ключ — только собственный, бизнеса (§19.2)**:
  `Business.web3AlchemyApiKey` (через `UpdateBusinessDto`) — платформа
  своего ключа не хранит и не предоставляет, без ключа Web3-раздел
  недоступен. Ключ write-only — `BusinessDto` отдаёт только
  `hasOwnWeb3ApiKey: boolean`, сам ключ клиенту никогда не возвращается.
  **Публичная версия (AI-13, §26)**: `GET /sites/:businessId/web3/wallet`
  (`PublicSitesController`, `Web3Service.getWalletInfoPublic` — без owner-
  проверки) для блока `web3wallet` в конструкторе сайта — единственный
  анонимный `GET` в проекте с бо́льшим `@Throttle`, чем у соседних
  (`getPublicProducts`/`getPublicServices`), потому что каждый вызов реально
  идёт во внешний Alchemy API за счёт лимита конкретного бизнеса, а не
  просто читает свою БД. Кеширования пока нет — известный пробел на будущее.
- `custom-entities` (`/businesses/:id/custom-entities[/:entityId/records]`) —
  AI_PLATFORM_ROADMAP.md §2.2/§20, AI-8: Custom Database Builder v1.
  Декларативная EAV-модель (`CustomEntity.fields`/`CustomEntityRecord.data`,
  оба `Json`), НЕ реальные Postgres DDL-миграции на бизнес — "создать
  сущность"/"добавить поле" пишет JSON-строку. Поля можно только добавлять
  (`appendField`), никогда не удалять/переименовывать — та же additive-only
  дисциплина, что у `Rule.actions`. 4 типа полей (string/number/boolean/date).

**Admin:**
- `admin` (`/admin`) — модерация, ban/unban, AI Infrastructure Overview.

**AI-оркестрационный слой** (`modules/ai/` — детальная история решений и
статус по фазам в `AI_PLATFORM_ROADMAP.md`, не дублируется здесь):
- Провайдер: `LlmProvider`/`GeminiAdapter` (Gemini, прямые REST-вызовы, без SDK).
- Оркестрация: `AiService` (чат по конкретному бизнесу,
  `/businesses/:id/ai/chat[/stream]`) и параллельный, структурно изолированный
  `AiOnboardingService` (`/ai/onboarding/chat`, бизнеса ещё не существует).
- Инструменты сегодня: `get_project_tree`/`list_media_assets` (чтение, `low`
  risk), `create_page`, `add_block`, `update_block_props` (allowlist из 6
  типов блоков — `heading`/`text`/`quote`/`spacer`/`image`/`button`, `image`/
  `button` валидируют `LinkTarget`/уже загруженный файл против реальных
  данных бизнеса), `set_style`, `create_custom_widget`, `create_entity`,
  `add_field` (все — `medium` risk, все пишут в `AuditLog`), `get_wallet_info`/
  `list_entities` (чтение, `low` risk, без аргументов), `publish_website`
  (`high` risk — единственный на сегодня инструмент, требующий подтверждения
  владельца перед выполнением, см. confirm-флоу ниже), `create_business`
  (onboarding-only, с опциональным auto-apply стартового шаблона).
- **Confirm-флоу для `high`/`critical` (AI-9, AI_PLATFORM_ROADMAP.md §2.8/§21)**:
  такой вызов не выполняется сразу — `AiService.runToolLoop` пишет `pending`-
  строку `AuditLog` (переиспользует ту же таблицу, `status` — `String`, не
  enum, доп. значения `pending`/`rejected` без миграции), отдаёт
  `confirmationId` в `AiStreamEvent`/`ChatResult` и останавливает весь ход.
  `POST .../ai/confirm/:id` выполняет РОВНО этот, уже провалидированный
  вызов (без нового обращения к LLM); `POST .../ai/reject/:id` отклоняет без
  выполнения. Оба — владелец-only через тот же `AiOwnershipGuard`, без
  `AiConfiguredGuard` (не зовут Gemini).
- Governance/cost-контроль вокруг самих AI-вызовов (не часть
  инструментального слоя выше): `modules/ai/quota` (Gemini RPM/RPD-лимиты,
  Redis-backed), `modules/ai/capacity` (AI Capacity & Cost Manager — бюджеты,
  дедуп-кэш, forecast, anomaly detection, admin-дашборд).

## AI-инициатива — статус одной строкой на фазу

Полная история и обоснования — `AI_PLATFORM_ROADMAP.md`. Кратко:

| Фаза | Статус |
|---|---|
| AI-1 — оркестрация, tool-registry, `get_project_tree` | ✅ done, verified |
| AI-2 — 6 write-инструментов редактирования сайта + chat UI | ✅ done, verified (image/button добавлены, включая addToCart/bookAppointment-ссылки) |
| AI-3 — SSE-стриминг, live-canvas apply, activity timeline | ✅ done, verified |
| AI-4 — разговорный онбординг бизнеса | ✅ done, verified |
| AI-5 — Business Logic Engine v1 | ✅ done, verified (3 действия: `send_notification`/`add_loyalty_points`/`set_membership_tier`) |
| AI-6 — Custom Widget Engine v1 | ✅ done, verified (`dataBindings`/`capabilities` ждут AI-7) |
| AI-7 — Web3-провайдер | ✅ первый ограниченный слайс done, verified (read-only баланс/NFT, `AlchemyAdapter`; wallet-connect/подпись транзакций — вне скоупа, см. `AI_PLATFORM_ROADMAP.md` §19) |
| AI-8 — Custom database builder | ✅ первый ограниченный слайс done, verified (декларативная EAV-модель, `create_entity`/`add_field`/`list_entities`; поля только добавляются, никогда не удаляются, см. `AI_PLATFORM_ROADMAP.md` §20) |
| AI-9 — HIGH/CRITICAL-risk confirm-флоу | ✅ первый ограниченный слайс done, verified (`publish_website` — первый и пока единственный `high`-risk инструмент; полный quality-gate пересмотр остальных инструментов — вне этого слайса, см. `AI_PLATFORM_ROADMAP.md` §21) |
| AI-10 — Universal Builder Expansion (новый под-трек, не одна фаза) | ✅ слайс 1 done, verified (`BlockStyle.background: 'custom'` + `customBackgroundColor`, свободный hex вместо только токенов темы; заодно найден и исправлен реальный pre-existing баг контраста текста на `dark`/`primary`/`custom` фоне — см. `AI_PLATFORM_ROADMAP.md` §23) |
| AI-11 — тот же трек, слайс 2 | ✅ done, verified (`FontChoice: 'google'` + курируемый список из 10 Google Fonts, реальная загрузка через `<link>` и React 19 head-hoisting, оба слота — заголовок/текст — независимо; без бэкенд/AI-tool изменений, тема не пишется AI — см. `AI_PLATFORM_ROADMAP.md` §24) |
| AI-12 — тот же трек, слайс 3 | ✅ done, verified (`SpacingValue = SpacingSize \| number` — произвольный px вместо только 5 пресетов, один общий `spacingToPx`/`'spacing'`-контрол на все 8 полей отступов сразу, а не 8 отдельных; `set_style` расширен с границей 0–400px; заодно пойман и исправлен falsy-zero баг до релиза — см. `AI_PLATFORM_ROADMAP.md` §25) |
| AI-13 — первый реальный Web3-блок конструктора | ✅ done, verified (новый анонимный `GET /sites/:id/web3/wallet` + `Web3Service.getWalletInfoPublic`, блок `web3wallet` по образцу `productgrid`; живая проверка на реальном настроенном кошельке бизнеса — реальный баланс и 25 NFT отрендерились и на канвасе, и в Preview — см. `AI_PLATFORM_ROADMAP.md` §26) |
| AI-14 — тот же трек (§23), слайс 4 | ✅ done, verified (двухцветный линейный градиент фона — `Background: 'gradient'` + `gradientFrom`/`gradientTo`/`gradientAngle`, тот же паттерн условной вставки полей, что у AI-10; контраст текста только при ОБОИХ тёмных стопах; `set_style` расширен с границей угла 0–360 — см. `AI_PLATFORM_ROADMAP.md` §27) |
| AI-15 — тот же трек, слайс 5 | ✅ done, verified (радиальный градиент — `gradientType: 'linear' \| 'radial'`, поле угла скрывается в инспекторе для радиального — см. `AI_PLATFORM_ROADMAP.md` §28) |
| AI-16 — тот же трек, слайс 6 (по запросу владельца «каждый виджет кастомизируемым») | ✅ done, verified (`BlockStyle.textColor` — свой цвет текста блока, побеждает над авто-контрастом фона; тот же универсальный per-block механизм, что у фона/отступов/градиента — см. `AI_PLATFORM_ROADMAP.md` §30, там же честно разобрана вторая трактовка запроса — per-widget-type кастомизация, ещё не сделана) |
| AI-17 — тот же трек, слайс 7 (рамка/тень на весь блок) | ✅ done, verified (`BlockStyle.borderWidth`/`borderColor`/`shadow` — отдельно от темного `cardBorder`/`cardShadow`, те только для карточных поверхностей ВНУТРИ блока; выбран владельцем из 4 кандидатов после второго, ещё большего брифа «переписать конструктор с нуля» — см. `AI_PLATFORM_ROADMAP.md` §31/§32) |

**Известные внешние блокеры** (не код-гэпы, см. `AI_PLATFORM_ROADMAP.md` за
подробностями): дневная квота Gemini free-tier (сбрасывается по
тихоокеанскому времени, отслеживается собственным `GeminiQuotaService`
поверх реального лимита провайдера). Интерактивная браузерная проверка
UI-путей (`claude-in-chrome`) больше не блокер — реальный клик-тест
AI-2…AI-9 пройден 2026-08-31, см. `AI_PLATFORM_ROADMAP.md` §22. `git push`
не работает в этом окружении вообще (нет сохранённых HTTPS-кредов) — каждый
коммит с AI-7 и позже остаётся только локальным.

**Полный, сведённый в одно место список того, что осталось сделать** (по
всей AI-инициативе, не только по билдеру) — `AI_PLATFORM_ROADMAP.md` §29,
написан специально для агента, который продолжит эту работу с нуля.

## Payment Plans — статус одной строкой

Полная история — в истории сессии, не в отдельном roadmap-файле (эта
инициатива моложе `AI_PLATFORM_ROADMAP.md` и пока не получила своего
файла). Реализовано: гейт конструктора для обоих сценариев создания
бизнеса, `BusinessSubscription`/`PlanSelectionEvent`, смена тарифа в любой
момент (мгновенное переключение между платными тирами без повторного
чекаута), 5 карточек тарифов с Growth Strategy и сравнением по
Growth & Advertising. **Не реализовано, только маркетинговый копирайт**:
реальное удержание % комиссии с Commerce-продаж (нужен Stripe Connect —
сейчас один Stripe-аккаунт платформы обслуживает всех, per-business Connect
явно отложен) и вся рекламная инфраструктура (показ/учёт рекламных мест,
revenue sharing) — сама подсистема не построена, только описание модели.

## Известные хвосты (не в AI/Payment Plans, найдены попутно)

- `prisma migrate dev`/`--create-only` падает с `P3006` на shadow-БД replay
  из-за одной более старой миграции — не влияет на реально применённую
  историю, обходной путь описан в `AGENTS.md` §9. Не расследовано, какая
  именно миграция и почему.
- Незапланированный `next start` (production-режим) процесс на порту 3000 —
  впервые замечен во время верификации AI-3 (`AI_PLATFORM_ROADMAP.md`
  §10.6), с тех пор возникал ЕЩЁ ТРИ РАЗА независимо (§27.3, §28, §32.3) уже
  в этой сессии — итого 4 раза. **Не закрыт** — кто именно его запускает,
  так и не установлено ни разу (это не команда ни одной задокументированной
  сессии). Это уже не редкая случайность, а происходит почти в каждой
  сессии, трогающей frontend dev-сервер. `pkill -f "next dev"` его не
  убивает (форкнутый `next-server` процесс не совпадает по паттерну) —
  рабочий способ: `ss -ltnp | grep :3000`, найти реальный `LISTEN`-PID,
  убить его напрямую. **Стоит настойчиво спросить владельца напрямую**, не
  запускает ли что-то на машине `next start` в фоне (cron/systemd/IDE run
  config) — см. `AI_PLATFORM_ROADMAP.md` §29.3 для полного списка открытых
  вопросов по проекту.
