export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  frontendUrl: string;
  sessionTtlSeconds: number;
  socketTicketTtlSeconds: number;
  logLevel: string | undefined;
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
  },
});
