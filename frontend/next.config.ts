import type { NextConfig } from 'next';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
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
