import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AuthenticatedRequest } from '@/common/types/authenticated-request';

/**
 * Владение бизнесом (тот же принцип, что и везде в проекте — см.
 * AI_PLATFORM_ROADMAP.md §0.1: "tenant" здесь буквально `Business.ownerId`),
 * вынесенное в `Guard` на уровень ВСЕГО `AiController` — каждый маршрут в
 * этом контроллере вложен под `:businessId` и без исключений требует
 * владения, включая read-only `GET activity` (AI-3, §10.7 роадмапа).
 *
 * Изначально это было объединено с проверкой конфигурации провайдера в
 * одном `AiAvailabilityGuard` — разделено на два guard'а, когда появился
 * `GET activity`: чтение ленты активности не должно зависеть от того,
 * настроен ли сейчас LLM-провайдер (история же не про сам провайдер), а
 * `chat`/`chat/stream` по-прежнему требуют обе проверки — см.
 * `AiConfiguredGuard`, применяемый ДОПОЛНИТЕЛЬНО на уровне метода для них.
 *
 * Для `chat/stream` (SSE) вынос владения именно в `Guard`, а не проверка
 * внутри самого хендлера/сервиса — не стилистический выбор, а обязательное
 * условие: `@Sse()` коммитит заголовки ответа по внутреннему таймеру
 * `setTimeout(…, 0)` сразу после подписки на возвращённый `Observable`, НЕ
 * дожидаясь резолва промиса хендлера — а реальная асинхронная проверка (DB-
 * запрос через Prisma) почти всегда медленнее этого таймера. Обнаружено
 * вживую curl'ом: `assertOwnership`, вызванная внутри `chatStream()` до
 * конструирования `Observable`, всё равно давала 403/404 не чистым HTTP-
 * статусом, а `event: error` уже открытого 200-потока с SSE-заголовками.
 * `CanActivate` гарантированно выполняется и дожидается (`await`) ДО того,
 * как Nest вообще узнаёт, что хендлер — SSE (guard'ы прогоняются первыми).
 */
@Injectable()
export class AiOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const businessId = request.params.businessId;
    if (typeof businessId !== 'string') {
      throw new NotFoundException('Бизнес не найден');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== request.user.id) throw new ForbiddenException('Это не ваш бизнес');

    return true;
  }
}
