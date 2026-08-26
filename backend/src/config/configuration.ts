export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  frontendUrl: string;
  sessionTtlSeconds: number;
  socketTicketTtlSeconds: number;
  logLevel: string | undefined;
  /** Базовый домен для системных сабдоменов сайтов (см. `DomainsService`,
   * `{slug}.${sitesBaseDomain}`) — не путать с `frontendUrl` (адрес самого
   * SaaS-приложения/дашборда). Локально — `localhost`, современные Chrome/
   * Firefox резолвят `*.localhost` на 127.0.0.1 без правки hosts-файла. */
  sitesBaseDomain: string;
  /** `undefined`, если Stripe не настроен (нет `.env`-значения) — см.
   * `StripeAdapter`, единственное место, которое их читает. Не бросает
   * ошибку при старте без них намеренно (см. `env.validation.ts`). */
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
}

export default (): { app: AppConfig } => ({
  app: {
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 30),
    socketTicketTtlSeconds: Number(process.env.SOCKET_TICKET_TTL_SECONDS ?? 60),
    logLevel: process.env.LOG_LEVEL,
    sitesBaseDomain: process.env.SITES_BASE_DOMAIN ?? 'localhost',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
});
