import 'reflect-metadata';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RedisIoAdapter } from './infrastructure/websocket/redis-io.adapter';

async function bootstrap(): Promise<void> {
  // `rawBody: true` — Nest сохраняет исходный Buffer тела запроса на
  // `request.rawBody` ДО JSON-парсинга, для ВСЕХ маршрутов (не только
  // вебхука) — сам JSON-парсинг остальных маршрутов при этом не меняется.
  // Нужен ровно одному месту — `StripeWebhookController` (см. её комментарий):
  // проверка подписи Stripe (`stripe.webhooks.constructEvent`) обязана
  // получить БАЙТЫ тела запроса как их прислал Stripe, а не результат
  // `JSON.parse` — даже одинаковое посимвольно значение, пересобранное через
  // `JSON.stringify`, даёт другую подпись HMAC.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;

  // НЕ настроено намеренно (`app.set('trust proxy', ...)` НЕ вызван) —
  // требует знания реальной топологии прод-развёртывания (какой конкретно
  // обратный прокси стоит перед приложением и сколько у него хопов), которой
  // здесь нет; включить вслепую (`true` = доверять любому `X-Forwarded-For`)
  // было бы опаснее, чем не включать — при развёртывании БЕЗ настоящего
  // прокси перед приложением это дало бы анонимному клиенту подделать свой
  // видимый IP одним заголовком. Пока не настроено, `request.ip` везде в
  // проекте (throttling — `ThrottlerModule` ниже, гео-таргетинг рекламы —
  // `resolveVisitorCountry`) видит адрес НЕПОСРЕДСТВЕННОГО подключения — за
  // настоящим обратным прокси в проде это будет адрес самого прокси, не
  // посетителя. ВАЖНО для того, кто настраивает реальное прод-развёртывание
  // за обратным прокси: без `trust proxy` с правильным числом хопов под эту
  // топологию throttling лимитирует "всех одинаково" вместо по-IP, а
  // гео-таргетинг рекламы (`targetCountries`) молча никогда никого не
  // находит — не ошибка, а неполная конфигурация, которую нужно закрыть на
  // этом шаге, а не потом гадать, почему географическое ограничение "не
  // работает".

  // Загруженные пользователем изображения (аватары/обложки/галерея) — см.
  // `common/lib/upload.ts`. Раздаются напрямую, без прохода через Nest-роуты.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.enableCors({
    origin: appConfig.frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const redisIoAdapter = new RedisIoAdapter(app);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(appConfig.port, '0.0.0.0');

  Logger.log(`Tavern backend слушает порт ${appConfig.port} (${appConfig.nodeEnv})`, 'Bootstrap');
}

void bootstrap();
