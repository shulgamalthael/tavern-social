import type { NextConfig } from 'next';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  /**
   * Дев-сервер по умолчанию блокирует cross-origin запросы к своим статическим
   * чанкам (`/_next/static/...`) — при открытии сайта через ngrok-туннель
   * (см. комментарий про `rewrites` ниже: сценарий уже учтён для Socket.IO и
   * `/uploads`, но не для самих чанков) это не ломает первый HTML-ответ
   * (SSR success), а тихо режет гидратацию: страница выглядит отрендеренной,
   * но React ни разу не подключается — лента/профиль/композер перестают
   * быть интерактивными без единой ошибки в консоли backend. Домен ngrok
   * меняется на каждый перезапуск бесплатного туннеля, поэтому здесь
   * wildcard, а не конкретный хост.
   *
   * `*.localhost` — та же самая защита, тот же самый симптом, только на
   * системных сабдомене опубликованных сайтов при локальной разработке
   * (`{slug}.localhost:3000`, см. `proxy.ts`/`DomainsService.
   * createSystemDomain`, `SITES_BASE_DOMAIN=localhost` в `.env`): без этой
   * записи `proxy.ts` успевает отрендерить оболочку страницы (SSR/rewrite на
   * `/site/[businessId]` отрабатывает ДО этой проверки — она про cross-origin
   * запросы САМОГО браузера обратно к дев-серверу, не про middleware), но
   * последующий вызов Server Action (`getAnonymousPublicSite`, которым
   * `PublicSiteWidget` догружает документ сайта) с origin `{slug}.localhost`
   * дев-сервер отклоняет как чужой — сайт молча зависает на «Загружаем
   * сайт…» навсегда, что выглядит как «вообще не получается перейти по
   * сабдомену». В проде этой проверки нет вовсе (`next start`/`next build`),
   * поэтому там подключённые домены/системные сабдомены никогда с этим не
   * сталкиваются — фикс нужен только для локальной разработки.
   */
  allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok-free.app', '*.ngrok.io', '*.localhost'],
  /**
   * Все загрузки картинок (аватар/обложка, галерея, аватар/обложка группы,
   * картинки поста) идут через Server Actions (`backendUpload`,
   * `shared/lib/backend-client.ts`) — тело такого запроса Next.js по
   * умолчанию режет на 1 МБ, что меньше даже одной обычной фотографии с
   * телефона. Backend со своей стороны разрешает до `MAX_IMAGE_BYTES` (5 МБ,
   * `common/lib/upload.ts`) на файл, а пост — до `MAX_POST_IMAGES` (10,
   * `posts.controller.ts`) таких файлов в одном мультипарт-запросе, поэтому
   * потолок здесь считается по худшему случаю (10 × 5 МБ) с запасом на
   * multipart-обвязку, а не берётся с потолка.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
  },
  /**
   * Проксирует Socket.IO polling-транспорт (обычные HTTP GET/POST) через тот
   * же origin, что и сама страница — так браузер всегда обращается к тому
   * протоколу/домену, каким открыт сайт, и никогда не упирается в
   * mixed-content (https-страница → http://localhost) или CORS-mismatch при
   * доступе не с localhost:3000 (ngrok-туннель, LAN-адрес телефона, прод-
   * домен). См. `shared/config/realtime.ts` — клиент подключается без
   * явного хоста и полагается именно на этот rewrite.
   *
   * Next.js rewrites не проксируют сам WebSocket-апгрейд (это HTTP `Upgrade`
   * запрос, требующий передачи сырого TCP-сокета, а не обычный
   * request/response) — Socket.IO в этом случае остаётся на long-polling
   * транспорте, что всё ещё полноценный real-time, просто с чуть большей
   * задержкой доставки, чем честный WebSocket.
   */
  async rewrites() {
    return [
      // Engine.IO шлёт запросы с trailing slash (`/socket.io/?EIO=...`), но
      // Next.js по умолчанию 308-редиректит их на путь без слэша ДО того,
      // как rewrites успевают сработать — редирект прозрачен для XHR
      // (308 сохраняет метод), но конечный путь, который реально доходит до
      // сопоставления rewrites, всегда без слэша. Оба варианта — на всякий
      // случай, если что-то когда-нибудь обратится напрямую без редиректа.
      {
        source: '/socket.io',
        // Engine.IO сам слушает строго на `/socket.io/` (со слэшем) — раз
        // Next.js уже снял слэш с source выше, возвращаем его явно здесь,
        // иначе backend отвечает 404 «Cannot GET /socket.io».
        destination: `${BACKEND_URL}/socket.io/`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
      // Тот же самый повод, что и для socket.io выше: `<img src="/uploads/...">`
      // рендерится прямо в браузере (не через backendFetch, который
      // server-only), поэтому должен быть на одном origin со страницей, а не
      // тянуться напрямую с backend-порта — иначе mixed-content/CORS в тех
      // же сценариях (ngrok, LAN, прод-домен без открытого backend наружу).
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
