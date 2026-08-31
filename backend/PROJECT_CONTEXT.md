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
  данных бизнеса), `set_style`, `create_custom_widget` (все — `medium` risk,
  все пишут в `AuditLog`), `create_business` (onboarding-only, с
  опциональным auto-apply стартового шаблона).
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
| AI-7 — Web3-провайдер | не начато — нужен выбор провайдера + API-ключ от владельца |
| AI-8 — Custom database builder | не начато |
| AI-9 — HIGH/CRITICAL-risk confirm-флоу, финальный quality-gate | не начато |

**Известные внешние блокеры** (не код-гэпы, см. `AI_PLATFORM_ROADMAP.md` за
подробностями): дневная квота Gemini free-tier (сбрасывается по
тихоокеанскому времени, отслеживается собственным `GeminiQuotaService`
поверх реального лимита провайдера); интерактивная браузерная проверка
части UI-путей ждёт подключения `claude-in-chrome` в конкретной сессии.

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
- Незапланированный `next start` (production-режим) процесс на порту 3000,
  обнаруженный во время верификации AI-3 (`AI_PLATFORM_ROADMAP.md` §10.6) —
  не запущен ни одной командой в задокументированных сессиях, оставлен
  нетронутым. Стоит уточнить у владельца, что это.
