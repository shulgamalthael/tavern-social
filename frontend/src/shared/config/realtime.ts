/**
 * Публичный (браузерный) адрес backend для Socket.IO. По умолчанию —
 * `undefined`: `io(undefined, opts)` в этом случае подключается к тому же
 * origin, с которого открыта страница (`window.location`), полагаясь на
 * прокси `/socket.io/*` → backend в `next.config.ts` (`rewrites`).
 *
 * Раньше здесь был жёсткий дефолт `http://localhost:4000`, и браузер
 * подключался к Socket.IO напрямую, минуя Next.js сервер — это ломалось
 * при любом доступе не с `localhost:3000` (ngrok-туннель, LAN-адрес
 * телефона, прод-домен): HTTPS-страница не может открыть `http://`-сокет
 * (mixed content), а CORS backend'а разрешал только один origin
 * (`FRONTEND_URL`). Same-origin через прокси работает с любого домена без
 * дополнительной настройки CORS.
 *
 * Задавайте `NEXT_PUBLIC_BACKEND_WS_URL` явно только если backend реально
 * живёт на домене, не покрытом прокси (например отдельный WS-домен в проде).
 */
export const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL || undefined;
